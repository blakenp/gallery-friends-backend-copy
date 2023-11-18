import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const bucketName = 'gallery-friends-profile-pics';
const generationMatchPrecondition = 0;

type Params = {
    params: {
      username: string
    }
};

const createUniqueFileName = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const uniqueFileName = `${uuidv4()}.${extension}`;
  return uniqueFileName;
};

export async function GET(req: NextRequest, { params: {username} }: Params) {
  const imageUrl = req.nextUrl.searchParams.get('imageUrl');
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');

  try {
    const user = await usersCollection.findOne( {username} );

    if (!user) {
      return NextResponse.json({Error: 'User not found!'}, {status: 404});
    }

    const response = NextResponse.json(user.profilePic);
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error retrieving user data:', error);
    return NextResponse.json({ error: 'Failed to retrieve user data' }, { status: 500 });
  }
};

export async function POST(req: NextRequest, { params: { username } }: Params) {
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const profilePicsCollection = db.collection('profile_pics');

  const credential = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_KEY as string, 'base64').toString()
  );

  const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT,
    credentials: { client_email: credential.client_email, private_key: credential.private_key },
  });

  try {
    const formData = await req.formData();
    console.log(formData);

    const uploadedFile = formData.get('profilePic');
    const currentProfilePic = formData.get('currentProfilePic')?.toString();

    if (!uploadedFile) {
      return NextResponse.json({}, { status: 400 });
    }

    const file = uploadedFile as File;

    console.log(`File name: ${file.name}`);
    console.log(`Content-Length: ${file.size}`);

    const fileArrayBuffer = await file.arrayBuffer();

    let fileName = file.name;

    const existingImage = await profilePicsCollection.findOne({ imageTitle: fileName });

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

    // Delete the current profile pic if it's not the default one
    if (currentProfilePic !== 'https://storage.googleapis.com/gallery-friends-profile-pics/default_profile_pic.png') {
      const currentProfilePicFilename = currentProfilePic?.split('/').pop();
      if (currentProfilePicFilename) {
        const currentProfilePicFile = storage.bucket(bucketName).file(currentProfilePicFilename);
        await currentProfilePicFile.delete();
        console.log(`Deleted current profile pic: ${currentProfilePic}`);
      }
    }

    // Update the user's profile pic with the new one
    await usersCollection.updateOne({ username }, { $set: { profilePic: `https://storage.googleapis.com/${bucketName}/${fileName}` } });

    return response;
  } catch (error) {
    console.error('Error during file upload:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
};

export async function PUT(req: NextRequest, { params: { username } }: Params) {
  const { username: newUsername, email: newEmail } = await req.json();

  if (typeof newUsername !== 'string' || typeof newEmail !== 'string') {
    return new NextResponse('Invalid data');
  }

  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const commentsCollection = db.collection('comments');
  const followersCollection = db.collection('followers');
  const likesCollection = db.collection('likes');

  try {
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return new NextResponse('User not found in database!', { status: 404 });
    }

    let updatedUsername = newUsername.trim() === '' ? user.username : newUsername;
    let updatedEmail = newEmail.trim() === '' ? user.email : newEmail;

    // Check if the new username is already taken
    if (updatedUsername !== user.username) {
      const existingUser = await usersCollection.findOne({ username: updatedUsername });
      if (existingUser) {
        console.log('Username is already taken');
        const response = new NextResponse('Username is already taken', {status: 400});
        middleware(response, req);
        return response;
      }
    }

    // Check if the new email is already in use
    if (updatedEmail !== user.email) {
      const existingUserWithEmail = await usersCollection.findOne({ email: updatedEmail });
      if (existingUserWithEmail) {
        console.log('Email is already in use');
        const response = new NextResponse('Email is already in use', { status: 402 });
        middleware(response, req);
        return response;
      }
    }

    await usersCollection.updateOne(
      { username },
      { $set: { username: updatedUsername, email: updatedEmail } }
    );

    // Update the username in the related collections
    await commentsCollection.updateMany(
      { userName: username },
      { $set: { userName: updatedUsername } }
    );

    await followersCollection.updateMany(
      { follower: username },
      { $set: { follower: updatedUsername } }
    );

    await followersCollection.updateMany(
      { followee: username },
      { $set: { followee: updatedUsername } }
    );

    await likesCollection.updateMany(
      { username: username },
      { $set: { username: updatedUsername } }
    );
    
    const response = NextResponse.json({updatedUsername, updatedEmail});
    middleware(response, req);
    return response;
  } catch (error) {
    return new NextResponse(JSON.stringify(error), { status: 500 });
  }
};

export async function DELETE(req: NextRequest, { params: { username } }: Params) {
  const response = new NextResponse('User and associated data successfully deleted');
  middleware(response, req);
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');
  const commentsCollection = db.collection('comments');
  const followersCollection = db.collection('followers');
  const likesCollection = db.collection('likes');

  const credential = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_KEY as string, 'base64').toString());

  const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT,
    credentials: { client_email: credential.client_email, private_key: credential.private_key },
  });

  try {
    const user = await usersCollection.findOne({ username });

    if (user) {
      // Delete user's images from MongoDB and GCS
      const userImages = await imagesCollection.find({ userId: user._id }).toArray();
      await imagesCollection.deleteMany({ userId: user._id });

      // Delete comments associated with user's images
      await commentsCollection.deleteMany({ userName: username });

      // Delete all follower data associated with the user
      await followersCollection.deleteMany({ $or: [{ follower: username }, { followee: username }] });

      // Delete all the liks data associated with the user
      await likesCollection.deleteMany({ username: username });

      // Delete the user document
      await usersCollection.deleteOne({ username });

      // Delete the profile picture from GCS if it's not the default
      const profilePic = user.profilePic;
      const defaultProfilePic = 'https://storage.googleapis.com/gallery-friends-profile-pics/default_profile_pic.png';
      if (profilePic !== defaultProfilePic) {
        const profilePicBucket = storage.bucket('gallery-friends-profile-pics');
        const profilePicFileName = profilePic.split('/').pop();
        const profilePicFile = profilePicBucket.file(profilePicFileName);
        await profilePicFile.delete();
      }

      // Delete user's images from the other GCS bucket
      const imagesBucket = storage.bucket('gallery-friends-images');
      for (const image of userImages) {
        const imageFileName = image.imageUrl.split('/').pop();
        const imageFile = imagesBucket.file(imageFileName);
        await imageFile.delete();
      }

      return response;
    } else {
      console.log('User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.log('Error deleting the user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
};

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse('Preflight Options Passed!');
  middleware(response, req);
  return response;
};
