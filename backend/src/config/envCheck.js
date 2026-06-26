'use strict';

const REQUIRED_PROD_ENV = [
  'NODE_ENV',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_ORIGIN',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'FRONTEND_URL',
];

const checkProductionEnv = () => {
  const missing = REQUIRED_PROD_ENV.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required production environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nPlease check your .env file and try again.');
    process.exit(1);
  }

  // Validate secrets are not using default values
  const weakSecrets = [
    { key: 'JWT_ACCESS_SECRET', weak: 'EventSphere_JWT_Secret_Access' },
    { key: 'JWT_REFRESH_SECRET', weak: 'EventSphere_JWT_Secret_Refresh' },
  ];

  const weak = weakSecrets.filter(({ key, weak }) => process.env[key] === weak);
  if (weak.length > 0) {
    console.error('❌ WEAK SECRETS DETECTED! Using default values in production is dangerous.');
    weak.forEach(({ key }) => console.error(`   - ${key} is using the default value`));
    console.error('\nPlease generate strong random secrets.');
    process.exit(1);
  }

  // Validate CORS origins format
  const origins = process.env.CLIENT_ORIGIN.split(',');
  const invalidOrigins = origins.filter((o) => {
    const trimmed = o.trim();
    return !trimmed.startsWith('https://') && !trimmed.startsWith('http://localhost');
  });
  
  if (invalidOrigins.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  CORS origins should use HTTPS in production:');
    invalidOrigins.forEach((o) => console.warn(`   - ${o}`));
  }

  console.log('✅ All production environment variables validated.');
};

module.exports = { checkProductionEnv };