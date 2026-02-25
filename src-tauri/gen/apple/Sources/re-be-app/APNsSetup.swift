/**
 * APNsSetup.swift — APNs device token registration for Tauri v2 iOS app.
 *
 * Since Tauri v2 controls the UIApplicationDelegate internally, we use
 * method swizzling to inject APNs callbacks onto the existing delegate.
 *
 * Flow:
 *   1. APNsBootstrap.setup() is called on app launch (from APNsLoader.m)
 *   2. We swizzle didRegisterForRemoteNotificationsWithDeviceToken onto the AppDelegate
 *   3. When iOS returns the APNs token, we inject it into the WKWebView via JS
 *   4. The frontend picks it up via window.__APNS_DEVICE_TOKEN__ or 'apns-token' event
 */

import UIKit
import UserNotifications
import WebKit
import os.log

// MARK: - APNs Bootstrap

@objc class APNsBootstrap: NSObject {

    /// The current APNs device token (hex string)
    static var deviceToken: String?

    /// Whether setup has been called
    private static var _setupDone = false

    /// Logger
    private static let log = OSLog(subsystem: "io.re-be.app", category: "APNs")

    /// Call once on app launch to set up APNs registration.
    @objc static func setup() {
        guard !_setupDone else { return }
        _setupDone = true

        os_log("[APNs] Setting up push notification registration", log: log, type: .info)

        // Set UNUserNotificationCenter delegate for foreground display + tap handling
        UNUserNotificationCenter.current().delegate = APNsNotificationDelegate.shared

        // Swizzle APNs delegate methods onto the existing AppDelegate
        guard let appDelegate = UIApplication.shared.delegate else {
            os_log("[APNs] No AppDelegate found, skipping swizzle", log: log, type: .error)
            return
        }

        let appDelegateClass: AnyClass = type(of: appDelegate)

        // Swizzle: didRegisterForRemoteNotificationsWithDeviceToken
        let tokenSelector = #selector(
            UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )
        let swizzledTokenSelector = #selector(
            APNsNotificationDelegate.apns_didRegisterForRemoteNotifications(application:deviceToken:)
        )
        if let swizzledMethod = class_getInstanceMethod(APNsNotificationDelegate.self, swizzledTokenSelector) {
            class_addMethod(
                appDelegateClass,
                tokenSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )
            os_log("[APNs] Swizzled didRegisterForRemoteNotificationsWithDeviceToken", log: log, type: .info)
        }

        // Swizzle: didFailToRegisterForRemoteNotificationsWithError
        let failSelector = #selector(
            UIApplicationDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)
        )
        let swizzledFailSelector = #selector(
            APNsNotificationDelegate.apns_didFailToRegister(application:error:)
        )
        if let swizzledMethod = class_getInstanceMethod(APNsNotificationDelegate.self, swizzledFailSelector) {
            class_addMethod(
                appDelegateClass,
                failSelector,
                method_getImplementation(swizzledMethod),
                method_getTypeEncoding(swizzledMethod)
            )
            os_log("[APNs] Swizzled didFailToRegisterForRemoteNotificationsWithError", log: log, type: .info)
        }
    }

    /// Request notification permission and register for remote notifications.
    @objc static func requestPermissionAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if let error = error {
                os_log("[APNs] Permission request error: %{public}@", log: log, type: .error, error.localizedDescription)
                return
            }

            os_log("[APNs] Permission granted: %{public}@", log: log, type: .info, granted ? "YES" : "NO")

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    /// Inject the device token into the WKWebView's JavaScript context.
    static func injectTokenIntoWebView(_ token: String) {
        DispatchQueue.main.async {
            guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let window = scene.windows.first,
                  let webView = findWebView(in: window) else {
                // WebView not ready yet — retry after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    injectTokenIntoWebView(token)
                }
                return
            }

            let js = """
            window.__APNS_DEVICE_TOKEN__ = '\(token)';
            window.dispatchEvent(new CustomEvent('apns-token', { detail: { token: '\(token)' } }));
            """

            webView.evaluateJavaScript(js) { _, error in
                if let error = error {
                    os_log("[APNs] JS injection error: %{public}@", log: log, type: .error, error.localizedDescription)
                } else {
                    os_log("[APNs] Token injected into WebView successfully", log: log, type: .info)
                }
            }
        }
    }

    /// Recursively find the WKWebView in the view hierarchy.
    static func findWebView(in view: UIView) -> WKWebView? {
        if let wk = view as? WKWebView { return wk }
        for subview in view.subviews {
            if let found = findWebView(in: subview) { return found }
        }
        return nil
    }
}

// MARK: - UNUserNotificationCenter Delegate + Swizzled Methods

@objc class APNsNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {

    static let shared = APNsNotificationDelegate()
    private static let log = OSLog(subsystem: "io.re-be.app", category: "APNs")

    // ─── Swizzled: didRegisterForRemoteNotificationsWithDeviceToken ───
    @objc func apns_didRegisterForRemoteNotifications(
        application: UIApplication,
        deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        APNsBootstrap.deviceToken = token
        os_log("[APNs] Device token received: %{public}@", log: APNsNotificationDelegate.log, type: .info, token)

        // Inject token into WebView so frontend can register it with Supabase
        APNsBootstrap.injectTokenIntoWebView(token)
    }

    // ─── Swizzled: didFailToRegisterForRemoteNotificationsWithError ───
    @objc func apns_didFailToRegister(
        application: UIApplication,
        error: Error
    ) {
        os_log("[APNs] Registration failed: %{public}@", log: APNsNotificationDelegate.log, type: .error, error.localizedDescription)
    }

    // ─── Foreground notification display ───
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner + badge + sound even when app is in foreground
        completionHandler([.banner, .badge, .sound])
    }

    // ─── Notification tap handling ───
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Pass the notification payload to the WebView for navigation
        if let data = try? JSONSerialization.data(withJSONObject: userInfo, options: []),
           let jsonString = String(data: data, encoding: .utf8) {
            DispatchQueue.main.async {
                if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let window = scene.windows.first,
                   let webView = APNsBootstrap.findWebView(in: window) {
                    let js = """
                    if (window.__APNS_NOTIFICATION_TAP__) {
                        window.__APNS_NOTIFICATION_TAP__(\(jsonString));
                    }
                    """
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
        }

        completionHandler()
    }
}
