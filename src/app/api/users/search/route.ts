import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query');

  const db = await connectToDatabase();
  const usersCollection = db.collection('users');

  try {
    // Find up to 8 usernames matching the query
    const users = await usersCollection
      .find({ username: { $regex: query, $options: 'i' } })
      .project({ username: 1, profilePic: 1 }) // Include the username and profilePic fields
      .limit(8) // Limit the result to 8 documents
      .toArray();

    const response = NextResponse.json(users);
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error retrieving user data:', error);
    return NextResponse.json({ error: 'Failed to retrieve user data' }, { status: 500 });
  }
};

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
};
