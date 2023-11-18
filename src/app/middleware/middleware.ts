import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = ['http://localhost:3000', 'http://*.localhost:3000/*', 'https://galleryfriends-frontend.vercel.app', 'https://*.galleryfriends-frontend.vercel.app/*']

function middleware(response: NextResponse | Response, request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const origin = requestHeaders.get('origin')

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
}

export default middleware