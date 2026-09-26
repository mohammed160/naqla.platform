if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
} else {
  Write-Host ".env already exists"
}
Write-Host "Open .env and add the Supabase Publishable key before running npm run dev."
