import { NextRequest, NextResponse } from 'next/server';
import middleware from '@/app/middleware/middleware';
import { connectToDatabase } from '@/components/mongodb';

type Params = {
  params: {
    username: string;
  };
};

export async function GET(req: NextRequest, { params: { username } }: Params) {
  const db = await connectToDatabase();
  const followersCollection = db.collection('followers');
  const usersCollection = db.collection('users');

  try {
    const user = await usersCollection.findOne({ username });

    if (!user) {
      return new NextResponse('User not found in the database!');
    }

    const following = await followersCollection.find({ follower: user.username }).toArray();
    const followers = await followersCollection.find({ followee: user.username }).toArray();

    const followingCount = following.length;
    const followersCount = followers.length;

    // Extract the usernames of following and followers
    const followingUsernames = following.map((f) => f.followee);
    const followersUsernames = followers.map((f) => f.follower);

    // Fetch the profile pictures corresponding to following and followers
    const followingProfiles = await usersCollection
      .find({ username: { $in: followingUsernames } })
      .toArray();
    const followersProfiles = await usersCollection
      .find({ username: { $in: followersUsernames } })
      .toArray();

    // Map the following to include the profile picture of the followee (Lucas's profile pic)
    const followeeWithProfilePics = following.map((f) => {
      const { followee } = f;
      const profilePic = followingProfiles.find((p) => p.username === followee)?.profilePic;
      return { followee, profilePic };
    });

    // Map the followers to include their profile picture of the follower (Jacob's profile pic)
    const followersWithProfilePics = followers.map((f) => {
      const { follower } = f;
      const profilePic = followersProfiles.find((p) => p.username === follower)?.profilePic;
      return { follower, profilePic };
    });

    const responseData = {
      following: followeeWithProfilePics,
      followingCount: followingCount,
      followers: followersWithProfilePics,
      followersCount: followersCount,
    };

    const response = NextResponse.json(responseData);
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error fetching followers:', error);
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 });
  }
};

export async function POST(req: NextRequest, { params: { username } }: Params) {
    const body = await req.json();
    const followeeName = body.followeeName;
  
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const followersCollection = db.collection('followers');
  
    try {
      const user = await usersCollection.findOne({ username });
      const followee = await usersCollection.findOne({ username: followeeName });
  
      if (!user || !followee) {
        const response = NextResponse.json({ error: 'User not found' }, { status: 404 });
        middleware(response, req);
        return response;
      }
  
      const existingFollow = await followersCollection.findOne({ follower: username, followee: followeeName });
  
      if (existingFollow) {
        const response = NextResponse.json({ error: 'You are already following this user' }, {status: 400});
        middleware(response, req);
        return response;
      }
  
      const followerObject = {
        follower: username,
        followee: followeeName,
      };
  
      await followersCollection.insertOne(followerObject);
  
      const response = new NextResponse(`Successfully followed ${followeeName}`);
      middleware(response, req);
      return response;
    } catch (error) {
      console.error('Error following user:', error);
      const response = NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
      middleware(response, req);
      return response;
    }
};

export async function DELETE(req: NextRequest, { params: {username} }: Params) {
    const db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const followersCollection = db.collection('followers');
    const otherUsername = req.nextUrl.searchParams.get('otherUsername');

    try {
    const existingFollow = await followersCollection.findOne({
      follower: username,
      followee: otherUsername,
    });

    if (!existingFollow) {
      const response = NextResponse.json({ error: 'Follower relationship not found' }, { status: 404 });
      middleware(response, req);
      return response;
    }

    // Delete the follower relationship
    await followersCollection.deleteOne({ follower: username, followee: otherUsername });

    const response = new NextResponse(`Successfully unfollowed ${otherUsername}`);
    middleware(response, req);
    return response;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    const response = NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
    middleware(response, req);
    return response;
  }
}

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse('Preflight Options Passed!');
    middleware(response, req);
    return response;
};