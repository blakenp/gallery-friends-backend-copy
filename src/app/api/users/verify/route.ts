import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import jwt, { JwtPayload } from 'jsonwebtoken';

const secretKey = Buffer.from(process.env.SECRET_APP_KEY as string, 'base64').toString();

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
  }
  
  export async function GET(req: NextRequest) {
    const authorizationHeader = req.headers.get('Authorization');
  
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  
    const sessionToken = authorizationHeader.substring('Bearer '.length).trim();
  
    try {
      // Verify the session token
      const decodedToken = jwt.verify(sessionToken, secretKey) as JwtPayload;
  
      // Check if the token is expired
      if (decodedToken.exp === undefined || decodedToken.exp * 1000 < Date.now()) {
        throw new Error('Token has expired or is invalid');
      }
  
      // Return the user verification status
      const response = new NextResponse(JSON.stringify({ verified: true }))
      middleware(response, req)
      return response
    } catch (error) {
      // Handle token verification error, including token expiration error
      console.error('Invalid session token:', error);
      return new NextResponse(JSON.stringify({ verified: false }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }