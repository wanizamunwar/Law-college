// Vercel routes by path, so this file exists only to be found. The handler
// matches the method as well, so a request this file does not own still gets a
// proper JSON 404 instead of the platform's bare one.
export { default } from '../server/handler.ts'
