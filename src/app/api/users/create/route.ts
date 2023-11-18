import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase, client } from '@/components/mongodb';
import bcrypt from 'bcrypt';

const bucketName = 'gallery-friends-profile-pics';
const defaultProfilePic = 'default_profile_pic.png';

async function createNewUser(user: any, req: NextRequest): Promise<any> {
  const db = await connectToDatabase();
  const collection = db.collection('users');

  const existingUserByUsername = await collection.findOne({ username: user.username });
  if (existingUserByUsername) {
    const errorResponse = new NextResponse('Username already exists', { status: 400 });
    middleware(errorResponse, req);
    return errorResponse;
  }

  const existingUserByEmail = await collection.findOne({ email: user.email });
  if (existingUserByEmail) {
    const errorResponse = new NextResponse('Email already exists', { status: 402 });
    middleware(errorResponse, req);
    return errorResponse;
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);

  const newUser = {
    username: user.username,
    email: user.email,
    password: hashedPassword,
    profilePic: user.profilePic,
  };

  const result = await collection.insertOne(newUser);
  const insertedDocument = await collection.findOne({ _id: result.insertedId });

  return insertedDocument;
};
  
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email, password } = body;
    const profilePic = `https://storage.googleapis.com/${bucketName}/${defaultProfilePic}`;

    // Perform validation checks for the required fields

    const user = {
      username,
      email,
      password,
      profilePic,
    };

    const createUserResponse = await createNewUser(user, req);

    if (createUserResponse instanceof NextResponse) {
      return createUserResponse;
    }

    const response = new NextResponse('Post to MongoDB complete!');
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('An error occurred:', error);
    const response = new NextResponse('An error occurred', { status: 400 });
    middleware(response, req);
    return response;
  } finally {
    client.close();
  }
};

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse('Preflight Options Passed!');
  middleware(response, req);
  return response;
}