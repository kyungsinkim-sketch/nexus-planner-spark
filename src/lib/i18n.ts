export type Language = 'ko' | 'en';

export const translations = {
  ko: {
    // Navigation
    calendar: '캘린더',
    projects: '프로젝트',
    chat: '채팅',
    myProfile: '내 프로필',
    admin: '관리자',
    inbox: '알림함',
    settings: '설정',
    
    // User Status
    atWork: '출근상태',
    notAtWork: '출근하지 않은 상태',
    lunch: '점심식사',
    training: '운동',
    setStatus: '상태 설정',
    
    // Calendar
    newEvent: '새 이벤트',
    today: '오늘',
    month: '월',
    week: '주',
    day: '일',
    agenda: '일정',
    
    // Event Types
    meeting: '회의',
    deadline: '마감',
    delivery: '납품',
    pt: '프레젠테이션',
    task: '작업',
    renatus: 'Renatus',
    todo: '할 일',
    deliverable: '산출물',
    
    // Projects
    allProjects: '전체 프로젝트',
    newProject: '새 프로젝트',
    active: '진행중',
    completed: '완료',
    onHold: '보류',
    cancelled: '취소',
    overview: '개요',
    files: '파일',
    todos: '할 일',
    budget: '예산',
    all: '전체',
    pending: '대기중',
    overdue: '지연',
    newTodo: '새 할 일',
    createTodo: '할 일 생성',
    noTodosFound: '할 일이 없습니다',
    requestedBy: '요청자:',
    createTodoDescription: '본인 또는 팀원에게 할 일을 생성합니다.',
    whatNeedsToBeDone: '무엇을 해야 하나요?',
    assignTo: '담당자',
    searchTeamMembers: '팀원 검색...',
    leaveEmptyToAssignToYourself: '비워두면 본인에게 할당됩니다',
    dueDate: '마감일',
    time: '시간',
    low: '낮음',
    normal: '보통',
    high: '높음',
    
    // Chat
    projectChats: '프로젝트 채팅',
    directMessages: '1:1 메시지',
    searchProjects: '프로젝트 검색...',
    searchUsers: '사용자 검색...',
    typeMessage: '메시지 입력...',
    selectChat: '채팅을 선택하세요',
    startConversation: '대화를 시작하세요',
    
    // Common
    cancel: '취소',
    save: '저장',
    delete: '삭제',
    edit: '편집',
    create: '생성',
    search: '검색',
    filter: '필터',
    export: '내보내기',
    import: '가져오기',
    upload: '업로드',
    download: '다운로드',
    close: '닫기',
    confirm: '확인',
    back: '뒤로',
    next: '다음',
    previous: '이전',
    loading: '로딩중...',
    noResults: '결과 없음',
    
    // Profile
    performance: '성과',
    portfolio: '포트폴리오',
    
    // Admin
    productivity: '생산성',
    contribution: '기여도',
    
    // Forms
    title: '제목',
    description: '설명',
    date: '날짜',
    startTime: '시작 시간',
    endTime: '종료 시간',
    type: '유형',
    status: '상태',
    priority: '우선순위',
    
    // File Upload
    addComment: '코멘트 추가',
    fileComment: '파일 설명...',
    
    // Events
    createEvent: '이벤트 생성',
    eventTitle: '이벤트 제목',
    eventType: '이벤트 유형',
    selectType: '유형 선택',
    enterEventTitle: '이벤트 제목 입력',
    eventCreated: '이벤트 생성됨',
    addedToCalendar: '캘린더에 추가됨',
    
    // Inbox
    notifications: '알림',
    markAsRead: '읽음으로 표시',
    markAllAsRead: '모두 읽음으로 표시',
    deleteNotification: '알림 삭제',
    
    // Settings
    googleCalendar: 'Google 캘린더',
    connect: '연결',
    disconnect: '연결 해제',
    sync: '동기화',
    autoSync: '자동 동기화',
    
    // Misc
    todaysEvents: '오늘의 일정',
    noEventsToday: '오늘 일정 없음',
    of: '중',
    events: '이벤트',
    exportToGoogle: 'Google로 내보내기',
    filterEvents: '이벤트 필터',
  },
  en: {
    // Navigation
    calendar: 'Calendar',
    projects: 'Projects',
    chat: 'Chat',
    myProfile: 'My Profile',
    admin: 'Admin',
    inbox: 'Inbox',
    settings: 'Settings',
    
    // User Status
    atWork: 'At Work',
    notAtWork: 'Not at Work',
    lunch: 'Lunch',
    training: 'Training',
    setStatus: 'Set Status',
    
    // Calendar
    newEvent: 'New Event',
    today: 'Today',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Agenda',
    
    // Event Types
    meeting: 'Meeting',
    deadline: 'Deadline',
    delivery: 'Delivery',
    pt: 'Presentation',
    task: 'Task',
    renatus: 'Renatus',
    todo: 'Todo',
    deliverable: 'Deliverable',
    
    // Projects
    allProjects: 'All Projects',
    newProject: 'New Project',
    active: 'Active',
    completed: 'Completed',
    onHold: 'On Hold',
    cancelled: 'Cancelled',
    overview: 'Overview',
    files: 'Files',
    todos: 'Todos',
    budget: 'Budget',
    all: 'All',
    pending: 'Pending',
    overdue: 'Overdue',
    newTodo: 'New To-do',
    createTodo: 'Create To-do',
    noTodosFound: 'No to-dos found',
    requestedBy: 'Requested by',
    createTodoDescription: 'Create a to-do for yourself or request work from a team member.',
    whatNeedsToBeDone: 'What needs to be done?',
    assignTo: 'Assign to',
    searchTeamMembers: 'Search team members...',
    leaveEmptyToAssignToYourself: 'Leave empty to assign to yourself',
    dueDate: 'Due Date',
    time: 'Time',
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    
    // Chat
    projectChats: 'Project Chats',
    directMessages: 'Direct Messages',
    searchProjects: 'Search projects...',
    searchUsers: 'Search users...',
    typeMessage: 'Type a message...',
    selectChat: 'Select a chat',
    startConversation: 'Start a conversation',
    
    // Common
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    upload: 'Upload',
    download: 'Download',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    loading: 'Loading...',
    noResults: 'No results',
    
    // Profile
    performance: 'Performance',
    portfolio: 'Portfolio',
    
    // Admin
    productivity: 'Productivity',
    contribution: 'Contribution',
    
    // Forms
    title: 'Title',
    description: 'Description',
    date: 'Date',
    startTime: 'Start Time',
    endTime: 'End Time',
    type: 'Type',
    status: 'Status',
    priority: 'Priority',
    
    // File Upload
    addComment: 'Add Comment',
    fileComment: 'File description...',
    
    // Events
    createEvent: 'Create Event',
    eventTitle: 'Event Title',
    eventType: 'Event Type',
    selectType: 'Select type',
    enterEventTitle: 'Enter event title',
    eventCreated: 'Event created',
    addedToCalendar: 'added to calendar',
    
    // Inbox
    notifications: 'Notifications',
    markAsRead: 'Mark as read',
    markAllAsRead: 'Mark all as read',
    deleteNotification: 'Delete notification',
    
    // Settings
    googleCalendar: 'Google Calendar',
    connect: 'Connect',
    disconnect: 'Disconnect',
    sync: 'Sync',
    autoSync: 'Auto Sync',
    
    // Misc
    todaysEvents: "Today's Events",
    noEventsToday: 'No events today',
    of: 'of',
    events: 'events',
    exportToGoogle: 'Export to Google',
    filterEvents: 'Filter Events',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(lang: Language, key: TranslationKey): string {
  return translations[lang][key];
}
