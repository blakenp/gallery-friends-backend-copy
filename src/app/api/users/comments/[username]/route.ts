import { NextRequest, NextResponse } from "next/server";
import middleware from "@/app/middleware/middleware";
import { connectToDatabase } from "@/components/mongodb";


type Params = {
    params: {
        username: string;
    }
}

export async function GET(req: NextRequest, { params: { username } }: Params) {
  const db = await connectToDatabase();
  const usersCollection = db.collection('users');
  const imagesCollection = db.collection('images');
  const commentsCollection = db.collection('comments');
  const imageUrl = req.nextUrl.searchParams.get('imageUrl');
  const image = await imagesCollection.findOne({ imageUrl: imageUrl });

  try {
    if (!image) {
      return NextResponse.json({ error: 'Image could not be found!' });
    }

    const comments = await commentsCollection.find({ imageId: image._id }).toArray();

    // Get the usernames and profile pics for each comment's user
    const commentData = await Promise.all(
      comments.map(async (comment) => {
        const user = await usersCollection.findOne({ username: comment.userName });
        return {
          userName: comment.userName,
          comment: comment.comment,
          profilePic: user?.profilePic,
        };
      })
    );

    const response = NextResponse.json(commentData);
    middleware(response, req);
    return response;
  } catch (error) {
    console.log(error);
    return new NextResponse('Failed to fetch comments');
  }
};

export async function POST(req: NextRequest, { params: { username } }: Params) {
    const body = await req.json();
    const imageUrl = body.imageUrl;

    // Extract the imageTitle from the imageUrl
    const imageTitle = imageUrl.split('/').pop().substring(0, imageUrl.lastIndexOf('.'));
    const response = new NextResponse('Comment Posted Successfully!')
    middleware(response, req);
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const commentsCollection = db.collection('comments');
    const imagesCollection = db.collection('images');
    const user = await usersCollection.findOne( {username} );

    try {
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const image = await imagesCollection.findOne( {imageTitle: imageTitle} );

        if (!image) {
            return NextResponse.json( {error: 'This user hasn\'t posted any images yet' }, { status: 404 });
        }
    
        const commentObject = {
            imageId: image._id,
            userName: user.username,
            comment: body.comment
        };

        await commentsCollection.insertOne(commentObject);
        
        console.log('before response!!!')
        return response;
    } catch(error) {
        return NextResponse.json({ commentError: error });
    }
}

export async function PUT(req: NextRequest, { params: { username } }: Params) {
  const { oldComment, newComment } = await req.json();
  console.log('Old: ', oldComment);
  console.log('New: ', newComment);
  
  const response = new NextResponse('Comment Edited Successfully!');
  middleware(response, req);
  
  const db = await connectToDatabase();
  const commentsCollection = db.collection('comments');

  try {
    // Update the comment with the new value
    await commentsCollection.updateOne(
      {
        userName: username,
        comment: oldComment,
      },
      {
        $set: {
          comment: newComment,
        },
      }
    );

    return response;
  } catch (error) {
    return NextResponse.json({ Error: error });
  }
};

export async function DELETE(req: NextRequest, { params: { username } }: Params) {
    const response = new NextResponse('Comment Successfully Deleted!!');
    middleware(response, req);
    const comment = req.nextUrl.searchParams.get('comment');
    console.log(comment);
    const db = await connectToDatabase();
    const commentsCollection = db.collection('comments');

    try {
      await commentsCollection.findOneAndDelete({ $and: [{ userName: username }, { comment }] });
  
      return response;
    } catch (error) {
      return NextResponse.json({ Error: error });
    }
}

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
}