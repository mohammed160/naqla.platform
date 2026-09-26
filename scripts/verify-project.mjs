import fs from 'node:fs';
import path from 'node:path';
import { bundleMigrations } from './bundle-migrations.mjs';

const root = process.cwd();

// 1. Critical project files that MUST exist
const requiredFiles = [
  'package.json',
  'index.html',
  'vite.config.js',
  '.env.example',
  'src/main.jsx',
  'src/App.jsx',

  'src/config/siteDefaults.js',
  'src/contexts/AuthContext.jsx',
  'src/lib/supabase.js',
  'src/lib/storage.js',
  'src/lib/helpers.js',
  'src/lib/projectCover.js',

  'src/components/ProjectSocialActions.jsx',
  'src/components/StudentReviewsGrid.jsx',
  'src/components/BunnyLecturePlayer.jsx',
  'src/components/YouTubeLecturePlayer.jsx',
  'src/components/ReviewsSection.jsx',
  'src/components/StudentProjectsPanel.jsx',
  'src/components/ProjectCoverField.jsx',

  'src/styles.css',
  'src/project-interactions.css',
  'src/premium-motion-reviews.css',
  'src/project-management-v3.css',
  'src/project-showcase-v2.css',
  'src/mobile-nav-fix.css',
  'src/responsive-optimizations.css',

  'src/pages/Home.jsx',
  'src/pages/Checkout.jsx',
  'src/pages/ProjectsGallery.jsx',
  'src/pages/ProjectDetails.jsx',
  'src/pages/StudentDashboard.jsx',
  'src/pages/WatchLecture.jsx',
  'src/pages/Login.jsx',
  'src/pages/Signup.jsx',
  'src/pages/UpdatePassword.jsx',

  'src/pages/admin/AdminUsers.jsx',
  'src/pages/admin/AdminCodes.jsx',
  'src/pages/admin/AdminProjects.jsx',
  'src/pages/admin/AdminLectures.jsx',
  'src/pages/admin/AdminCourses.jsx',
  'src/pages/admin/AdminContent.jsx',
  'src/pages/admin/AdminPayments.jsx',
  'src/pages/admin/AdminPlan.jsx',
  'src/pages/Join.jsx',
  'src/pages/Faq.jsx',
  'src/pages/VerifyEmail.jsx',
  'src/config/faqDefaults.js',
  'src/components/TrackDish.jsx',
  'src/components/TrackExplorer.jsx',
  'src/components/AudiencePills.jsx',
  'src/components/TrackPreview.jsx',
  'src/components/PlanCard.jsx',
  'src/components/BrandShapes.jsx',
  'src/lib/membership.js',
  'src/lib/tracks.js',
  'src/naqla.css',
  'public/brand/logo-mark.svg',
  'public/brand/logo-full.svg',
  'public/brand/pattern.svg',

  'supabase/functions/admin-delete-user/index.ts',
  'supabase/functions/get-bunny-embed/index.ts',
  'supabase/functions/fawry-wallet-charge/index.ts',
  'supabase/functions/fawry-webhook/index.ts',

  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_v7_motion_content.sql',
  'supabase/migrations/003_v7_complete_fixes.sql',
  'supabase/migrations/004_youtube_lecture_sources.sql',
  'supabase/migrations/005_student_reviews.sql',
  'supabase/migrations/006_admin_projects_crud.sql',
  'supabase/migrations/006_admin_reset_password.sql',
  'supabase/migrations/007_project_multi_images.sql',
  'supabase/migrations/008_project_covers_and_student_edit.sql',
  'supabase/migrations/009_bunny_stream_sources.sql',
  'supabase/migrations/010_prevent_invalid_bunny_source_ids.sql',
  'supabase/migrations/20260805_activation_code_redeem_fix.sql',
  'supabase/migrations/20260815_activation_code_admin_management.sql',
  'supabase/migrations/20260817_project_interactions_and_admin_delete.sql',
  'supabase/migrations/20260817_reviews_repair_and_sales.sql',
  'supabase/migrations/20260920_naqla_lifetime_membership.sql',
  'supabase/migrations/20260926_profile_guard_and_admin_bootstrap.sql',
  'supabase/naqla_full_setup.sql',
  'supabase/scripts/make_admin.sql',

  'public/_redirects',
  'public/.htaccess',
  'vercel.json',
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missingFiles.length) {
  console.error('\n❌ FATAL: The following critical files are MISSING from the project:');
  missingFiles.forEach((file) => console.error(`   - ${file}`));
  console.error('\nAction required: Do not deploy or build without these files!\n');
  process.exit(1);
}

// 2. Deep Feature Integrity Checks
function verifyFileContent(filePath, checks) {
  const fullPath = path.join(root, filePath);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  checks.forEach(({ name, pattern }) => {
    if (!pattern.test(content)) {
      console.error(`❌ REGRESSION DETECTED: "${name}" is missing from ${filePath}!`);
      process.exit(1);
    }
  });
}

verifyFileContent('src/config/siteDefaults.js', [
  { name: 'Vodafone Cash Payment Support', pattern: /vodafone_cash/ },
  { name: 'InstaPay Payment Support', pattern: /instapay/ },
  { name: 'Naqla Branding', pattern: /نقلة/ },
]);

verifyFileContent('src/pages/Checkout.jsx', [
  { name: 'Vodafone Cash Option', pattern: /vodafone_cash/ },
  { name: 'InstaPay Option', pattern: /instapay/ },
  { name: 'TRC20 USDT Network Warning & Form', pattern: /trc20/ },
]);

verifyFileContent('src/pages/admin/AdminCodes.jsx', [
  { name: 'Copy Activation Code Function', pattern: /copyCode/ },
  { name: 'CSV Export Function', pattern: /downloadGeneratedCsv/ },
  { name: 'Full Code Persistence', pattern: /code_value/ },
]);

verifyFileContent('src/pages/admin/AdminUsers.jsx', [
  { name: 'Admin Direct Password Reset', pattern: /admin_reset_user_password/ },
  { name: 'Student Deletion Action', pattern: /deleteStudent/ },
]);

verifyFileContent('src/pages/ProjectsGallery.jsx', [
  { name: 'Social Actions Integration', pattern: /ProjectSocialActions/ },
  { name: 'Project Like Handler', pattern: /toggleLike/ },
  { name: 'Project Save Handler', pattern: /toggleSave/ },
]);

verifyFileContent('src/pages/ProjectDetails.jsx', [
  { name: 'Student Project Comments Section', pattern: /comments/ },
  { name: 'Project Social Actions', pattern: /ProjectSocialActions/ },
]);

verifyFileContent('src/pages/WatchLecture.jsx', [
  { name: 'Bunny Stream Integration', pattern: /BunnyLecturePlayer/ },
  { name: 'Playback Resume Support', pattern: /resumeSeconds/ },
]);

verifyFileContent('src/contexts/AuthContext.jsx', [
  { name: 'Auth Session Loading Loop Guard', pattern: /initializedRef/ },
]);

// 3. Environment Checks (if .env exists)
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const checks = {
    VITE_SUPABASE_URL: /VITE_SUPABASE_URL=(.+)/.exec(env)?.[1]?.trim(),
    VITE_SUPABASE_PUBLISHABLE_KEY: /VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/.exec(env)?.[1]?.trim(),
  };
  const invalid = Object.entries(checks).filter(([, value]) => !value);
  if (invalid.length) {
    console.error('❌ Missing environment values: ' + invalid.map(([key]) => key).join(', '));
    process.exit(1);
  }
}

// 3. The one-paste setup file must match the migrations it was built from.
const setupPath = path.join(root, 'supabase/naqla_full_setup.sql');
if (fs.readFileSync(setupPath, 'utf8') !== bundleMigrations().content) {
  console.error('\n❌ supabase/naqla_full_setup.sql is out of date with supabase/migrations.');
  console.error('   Run: npm run db:bundle\n');
  process.exit(1);
}

console.log('✓ All critical files and components verified.');
console.log('✓ supabase/naqla_full_setup.sql matches the migrations.');
console.log('✓ Payment methods integrity verified (Vodafone Cash, InstaPay, Fawry, TRC20).');
console.log('✓ Activation code copy and persistence verified.');
console.log('✓ Interactive student projects and comments verified.');
console.log('✓ Admin password reset and student deletion verified.');
console.log('✓ Bunny Stream & video resume playback verified.');
console.log('✓ Auth session loop guard verified.');
console.log('✓ All project checks passed.');
