import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const secretKey = Buffer.from(process.env.SECRET_APP_KEY as string, 'base64').toString();

async function loginUser(username: string, password: string, req: NextRequest): Promise<NextResponse | { user: any; sessionToken: string }> {
  const db = await connectToDatabase();
  const collection = db.collection('users');

  // Find the user by username or email
  const user = await collection.findOne({ $or: [{ username }, { email: username }] });

  if (!user) {
    const errorResponse = new NextResponse('User not found in system!', { status: 400 });
    middleware(errorResponse, req);
    return errorResponse;
  }

  // Compare the provided password with the stored hashed password
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    const errorResponse = new NextResponse('Invalid username or password', { status: 401 });
    middleware(errorResponse, req);
    return errorResponse;
  }

  // Generate a JWT token with the user data
  const sessionToken = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });

  // Return the user and token
  return { user, sessionToken };
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  try {
    const loginResponse = await loginUser(username, password, req);

    if (loginResponse instanceof NextResponse) {
      return loginResponse;
    }

    // Return the token and user in the response
    const { user, sessionToken } = loginResponse;
    const response = new NextResponse(JSON.stringify({ user, sessionToken }));
    middleware(response, req);
    return response;
  } catch (error) {
    // Handle login error
    console.error(error);
    const response = new NextResponse('Login failed', { status: 401 });
    middleware(response, req);
    return response;
  }
}

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse('Preflight Options Passed!');
  middleware(response, req);
  return response;
}
