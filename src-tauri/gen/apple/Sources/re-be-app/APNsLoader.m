/**
 * APNsLoader.m — Objective-C bootstrap to trigger APNs setup on app launch.
 *
 * Uses +[NSObject load] to call APNsBootstrap.setup() as early as possible,
 * before the Tauri framework finishes initializing.
 *
 * The actual APNs registration (requestAuthorization + registerForRemoteNotifications)
 * is delayed by 3 seconds to ensure the WKWebView is ready to receive the token.
 */

#import <UIKit/UIKit.h>

// Forward-declare the Swift class (auto-generated bridging header: <ModuleName>-Swift.h)
// XcodeGen with DEFINES_MODULE=YES generates this header automatically.
@interface APNsBootstrap : NSObject
+ (void)setup;
+ (void)requestPermissionAndRegister;
@end

@interface APNsLoader : NSObject
@end

@implementation APNsLoader

+ (void)load {
    // Setup must happen on main queue after UIApplication is ready
    dispatch_async(dispatch_get_main_queue(), ^{
        // Swizzle delegate methods
        [APNsBootstrap setup];

        // Delay registration to let Tauri + WKWebView initialize
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3 * NSEC_PER_SEC)),
            dispatch_get_main_queue(),
            ^{
                [APNsBootstrap requestPermissionAndRegister];
            }
        );
    });
}

@end
