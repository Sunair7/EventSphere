// config/tutorialSteps.js
export const TUTORIAL_STEPS = {
  admin: [
    {
      target: '.dashboard-header',
      content: 'Welcome to EventSphere Admin! Manage your expos, booths, sessions, exhibitors, and attendees all in one place.',
      placement: 'center',
      title: 'Welcome, Admin!',
    },
    {
      target: '.expos-tab',
      content: 'Create and manage expos here. Set up the floor plan, add sessions, and manage registrations.',
      placement: 'right',
      title: 'Manage Expos',
    },
    {
      target: '.exhibitors-tab',
      content: 'Review exhibitor applications, verify documents, and manage booth assignments.',
      placement: 'right',
      title: 'Exhibitor Management',
    },
    {
      target: '.attendees-tab',
      content: 'View all registered attendees and manage their access.',
      placement: 'right',
      title: 'Attendee Management',
    },
    {
      target: '.dashboard-content',
      content: 'You\'re all set! Start by creating your first expo. Explore the dashboard and discover all the features.',
      placement: 'center',
      title: 'Ready to Go! 🚀',
    },
  ],
  exhibitor: [
    {
      target: '.dashboard-header',
      content: 'Welcome to EventSphere Exhibitor! Showcase your company, reserve booths, and connect with attendees.',
      placement: 'center',
      title: 'Welcome, Exhibitor!',
    },
    {
      target: '.profile-tab',
      content: 'Complete your company profile. Add your logo, description, and upload verification documents.',
      placement: 'right',
      title: 'Company Profile',
    },
    {
      target: '.expos-tab',
      content: 'Discover expos that match your industry. View details, available booths, and registration deadlines.',
      placement: 'right',
      title: 'Find Expos',
    },
    {
      target: '.sessions-tab',
      content: 'Register for sessions relevant to your business. Network with attendees and speakers.',
      placement: 'right',
      title: 'Session Registration',
    },
    {
      target: '.dashboard-content',
      content: 'You\'re ready! Start exploring expos and reserve your booth space today!',
      placement: 'center',
      title: 'Let\'s Go! 🚀',
    },
  ],
  attendee: [
    {
      target: '.dashboard-header',
      content: 'Welcome to EventSphere Attendee! Discover expos, register for sessions, and connect with exhibitors.',
      placement: 'center',
      title: 'Welcome, Attendee!',
    },
    {
      target: '.expos-tab',
      content: 'Find expos that interest you. View schedules, speakers, and exhibitor lists.',
      placement: 'right',
      title: 'Discover Expos',
    },
    {
      target: '.sessions-tab',
      content: 'Browse sessions and register for the ones you want to attend. Track your schedule easily.',
      placement: 'right',
      title: 'Session Registration',
    },
    {
      target: '.schedule-tab',
      content: 'View all your registered sessions in one place. Never miss a session!',
      placement: 'right',
      title: 'My Schedule',
    },
    {
      target: '.dashboard-content',
      content: 'You\'re all set! Start exploring expos and register for sessions today!',
      placement: 'center',
      title: 'Let\'s Go! 🚀',
    },
  ],
};