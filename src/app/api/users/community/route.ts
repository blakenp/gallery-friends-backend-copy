import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';

export async function GET(req: NextRequest) {
  const db = await connectToDatabase();
  const imagesCollection = db.collection('images');
  const usersCollection = db.collection('users');

  try {
    // Retrieve a random sample of images
    const images = await imagesCollection.aggregate([{ $sample: { size: 18 } }]).toArray();
    const imageUrls = images.map((image) => image.imageUrl);

    // Retrieve the users associated with the images
    const userIds = images.map((image) => image.userId);
    const users = await usersCollection.find({ _id: { $in: userIds } }).toArray();
    const userMap: { [key: string]: any } = {}; // Add index signature

    for (const user of users) {
      userMap[user._id.toString()] = user;
    }

    const imageData = images.map((image) => ({
      imageUrl: image.imageUrl,
      username: userMap[image.userId].username || '',
      profilePic: userMap[image.userId].profilePic || '',
    }));

    const response = NextResponse.json({ imageData });
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error retrieving random images:', error);
    return NextResponse.json({ error: 'Failed to retrieve random images' }, { status: 500 });
  }
};

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
};
