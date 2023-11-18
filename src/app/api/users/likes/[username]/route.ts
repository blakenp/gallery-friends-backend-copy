import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';

type Params = {
    params: {
      username: string
    }
}

export async function GET(req: NextRequest, { params: { username } }: Params) {
  const db = await connectToDatabase();
  const likesCollection = db.collection('likes');
  const imageUrlsString = req.nextUrl.searchParams.get('imageUrls'); // Retrieve the comma-separated image URLs string
  const imageUrls = imageUrlsString?.split(',').map((url) => decodeURIComponent(url));
  console.log('imageUrls: ', imageUrls);

  try {
      const likes = await likesCollection.find({ imageUrl: { $in: imageUrls } }).toArray();
      console.log('likes: ', likes);

      // Create the formattedLikesMap to store the count of likes per image
      const formattedLikesMap = new Map();

      // Loop through the likes array and build the formattedLikesMap
      likes.forEach((like) => {
          const { imageUrl } = like;
          if (formattedLikesMap.has(imageUrl)) {
              // If the map already has the image URL as a key, increment the count
              formattedLikesMap.set(imageUrl, formattedLikesMap.get(imageUrl) + 1);
          } else {
              // If the image URL is not in the map, add it as a key with the initial count 1
              formattedLikesMap.set(imageUrl, 1);
          }
      });

      console.log('formattedLikesMap: ', formattedLikesMap);

      const likesChecker = new Map();

      // Loop through the likes array and build the likesChecker map
      likes.forEach((like) => {
          const { imageUrl, username } = like;
          if (likesChecker.has(imageUrl)) {
              // If the map already has the image URL as a key, add the username to the usernames array
              const usernames = likesChecker.get(imageUrl);
              likesChecker.set(imageUrl, [...usernames, username]);
          } else {
              // If the image URL is not in the map, add it as a key with an array containing the username
              likesChecker.set(imageUrl, [username]);
          }
      });

      console.log('likesChecker: ', likesChecker);

      // Convert the Maps to plain objects using Object.fromEntries()
      const formattedLikesObject = Object.fromEntries(formattedLikesMap);
      const likesCheckerObject = Object.fromEntries(likesChecker);

      const response = NextResponse.json({ formattedLikesMap: formattedLikesObject, likesChecker: likesCheckerObject });
      middleware(response, req);
      return response;
  } catch (error) {
      const response = NextResponse.json({ error: 'Error fetching Likes' });
      middleware(response, req);
      return response;
  }
};

export async function POST(req: NextRequest, { params: { username } }: Params) {
    const body = await req.json();
    const imageUrl = body.imageUrl;
  
    const db = await connectToDatabase();
    const imagesCollection = db.collection('images');
    const likesCollection = db.collection('likes');
  
    try {
      const image = await imagesCollection.findOne({ imageUrl });
  
      if (!image) {
        return new NextResponse('Image not found in database!');
      }
  
      const likeData = {
        imageId: image._id,
        imageUrl: image.imageUrl,
        username: username,
      };
  
      await likesCollection.insertOne(likeData);
  
      const response = NextResponse.json({ likeData });
      middleware(response, req);
      return response;
    } catch (error) {
      return NextResponse.json({ error: 'Error Liking Post' }, { status: 500 });
    }
};  

export async function DELETE(req: NextRequest, { params: { username } }: Params) {
  const response = new NextResponse('Successfully unliked post!');
  middleware(response, req);
  const db = await connectToDatabase();
  const likesCollection = db.collection('likes');
  const imageUrl = req.nextUrl.searchParams.get('imageUrl');
  
  try {
    // Find the document in the likesCollection that matches the username and imageUrl
    const likeDocument = await likesCollection.findOne({ username, imageUrl });

    if (!likeDocument) {
      return NextResponse.json({ error: 'Like not found for the user and image' }, {status: 404});
    }

    // Delete the document from the likesCollection
    await likesCollection.deleteOne({ _id: likeDocument._id });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Error unliking post' }, {status: 500});
  }
};

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
};