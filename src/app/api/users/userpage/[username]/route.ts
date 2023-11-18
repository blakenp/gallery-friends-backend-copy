import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const bucketName = 'gallery-friends-images';
const generationMatchPrecondition = 0;

type Params = {
    params: {
      username: string
    }
}

const createUniqueFileName = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const uniqueFileName = `${uuidv4()}.${extension}`;
  return uniqueFileName;
};

export async function GET(req: NextRequest, { params: { username } }: Params) {
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');

  try {
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find all images associated with the user's _id
    const images = await imagesCollection.find({ userId: user._id }).toArray();

    // Extract only the imageUrl from each image object
    const imageUrls = images.map((image) => image.imageUrl);
    const profilePic = user.profilePic;

    const response = NextResponse.json( {imageUrls, profilePic} );
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error retrieving user data:', error);
    return NextResponse.json({ error: 'Failed to retrieve user data' }, { status: 500 });
  }
}


export async function POST(req: NextRequest, { params: { username } }: Params) {

  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');

  const credential = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_KEY as string, "base64").toString()
  );

  const storage = new Storage({ projectId: process.env.GOOGLE_PROJECT,
    credentials: { client_email: credential.client_email, private_key: credential.private_key} 
  })

  try {
    const formData = await req.formData();
    console.log(formData);

    const uploadedFile = formData.get('image');

    if (!uploadedFile) {
      return NextResponse.json({}, { status: 400 });
    }

    const file = uploadedFile as File;

    console.log(`File name: ${file.name}`);
    console.log(`Content-Length: ${file.size}`);

    const fileArrayBuffer = await file.arrayBuffer();

    let fileName = file.name;

    const existingImage = await imagesCollection.findOne({ imageTitle: fileName });

    if (existingImage) {
      fileName = createUniqueFileName(fileName);
      console.log(`Existing filename found. Generating unique filename: ${fileName}`);
    }

    const gcsFile = storage.bucket(bucketName).file(fileName);
    const response = new NextResponse('Image Posted Successfully!!!');

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    let contentType = '';
    if (fileExtension === 'png') {
    contentType = 'image/png';
    } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
    contentType = 'image/jpeg';
    } else if (fileExtension === 'gif') {
        contentType = 'image/gif';
    } else {
    console.error('Invalid file type');
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const [location] = await gcsFile.createResumableUpload({
    metadata: {
        contentType,
    },
    });

    const options = {
      uri: location,
      resumable: true,
      validation: false,
      preconditionOpts: { ifGenerationMatch: generationMatchPrecondition },
    };

    // Apply any necessary middleware
    middleware(response, req);

    // Save the image to Google Cloud Storage
    await gcsFile.save(Buffer.from(fileArrayBuffer), options);

    console.log(`${fileName} uploaded to ${bucketName}`);

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create a new image object
    const imageObject = {
      userId: user._id,
      imageUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
      imageTitle: fileName
    };

    await imagesCollection.insertOne(imageObject);

    return response
  } catch (error) {
    console.error('Error during file upload:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params: { username } }: Params) {
  const response = new NextResponse('Image and associated comments successfully deleted');
  middleware(response, req);
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');
  const commentsCollection = db.collection('comments');

  const imageUrl = req.nextUrl.searchParams.get('imageUrl');

  try {
    console.log('in try catch');
    const user = await usersCollection.findOne({ username });

    if (user) {
      const image = await imagesCollection.findOne({ $and: [{ userId: user._id }, { imageUrl }] });

      if (image) {
        const imageId = image._id;

        // Delete the associated comments
        await commentsCollection.deleteMany({ imageId });

        const fileName = image.imageUrl.split('/').pop(); // Extract the filename from the imageUrl

        const credential = JSON.parse(
          Buffer.from(process.env.GOOGLE_SERVICE_KEY as string, "base64").toString()
        );

        const storage = new Storage({ projectId: process.env.GOOGLE_PROJECT,
          credentials: { client_email: credential.client_email, private_key: credential.private_key} 
        });
        
        const bucket = storage.bucket(bucketName);
        const gcsFile = bucket.file(fileName);

        // Delete the file from Google Cloud Storage
        await gcsFile.delete();

        // Delete the image document from the MongoDB collection
        await imagesCollection.deleteOne({ $and: [{ userId: user._id }, { imageUrl }] });

        return response;
      } else {
        console.log('Image not found');
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }
    } else {
      console.log('User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.log('Error deleting the image:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse('Preflight Options Passed!');
  middleware(response, req);
  return response;
}
