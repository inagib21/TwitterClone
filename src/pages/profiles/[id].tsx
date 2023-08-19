import {  GetStaticPaths, GetStaticPropsContext, InferGetServerSidePropsType, NextPage } from "next";
import Head from "next/head";
import { ssgHelper } from "../api/ssgHelper";
import { api } from " /utils/api";
import ErrorPage from "next/error";
import Link from "next/link";
import { IconHoverEffect } from " /components/IconHoverEffect";
import { VscArrowLeft } from "react-icons/vsc";
import { ProfileImage } from " /components/ProfileImage";
import { InfiniteTweetList } from " /components/InfiniteTweetList";
import { Button } from " /components/Button";
import { useSession } from "next-auth/react";
import { getServerSession } from "next-auth";




// Define the ProfilePage component
const ProfilePage: NextPage<InferGetServerSidePropsType<typeof getStaticProps>> = ({ id }) => {
    // Fetch user profile using trpc query
    const { data: profile } = api.profile.getById.useQuery({ id });
  
    // Fetch user's tweets using trpc query
    const tweets = api.tweet.infiniteProfileFeed.useInfiniteQuery({
      userId: id,}, {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
    const trpcUtils = api.useContext()
    const toggleFollow = api.profile.toggleFollow.useMutation({ onSuccess: ({
      addedFollow }) =>{
        trpcUtils.profile.getById.setData({ id}, oldData => {
          if (oldData == null) return

          const countModifier = addedFollow ? 1 : -1
          return{
            ...oldData,
            isFollowing: addedFollow,
            followersCount: oldData.followersCount + countModifier,          
          }
        } )
      } })
  
    // Check if profile data exists, if not, show a 404 page
    if (profile == null || profile.name == null) {
      return <ErrorPage statusCode={404} />;
    }
  
    // Render the profile page
    return (
      <>
        <Head>
          <title>{`Twitter Clone ${profile.name}`}</title>
        </Head>
        <header className="sticky top-0 z-10 flex items-center border-b bg-white px-4 py-4">
          <Link href=".." className="mr-2">
            <IconHoverEffect>
              <VscArrowLeft className="h-6 w-6" />
            </IconHoverEffect>
          </Link>
          <ProfileImage src={profile.image} className="flex-shrink-0" />
          <div className="ml-2 flex-grow">
            <h1 className="text-lg font-bold">{profile.name}</h1>
            <div className="text-gray-500">
              {profile.tweetsCount}{" "}
              {getPlural(profile.tweetsCount, "tweet", "tweets")}{" "}
              {getPlural(profile.followersCount, "Follower", "Followers")}{" "}
              {profile.followCount}Following
            </div>
            <FollowButton
            isFollowing={profile.isFollowing}
            isLoading={toggleFollow.isLoading}
            userId={id}
            onClick={() => toggleFollow.mutate({userId: id})} 
            />
          </div>
        </header>
        <main>
          <InfiniteTweetList
            tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
            isError={tweets.isError}
            isLoading={tweets.isLoading}
            hasMore={tweets.hasNextPage}
            fetchNewTweets={tweets.fetchNextPage}
          />
        </main>
      </>
    );
  };
  
  // Define the FollowButton component
  function FollowButton({ userId, isFollowing, isLoading ,onClick}:
    { userId: string, isFollowing: boolean, isLoading: boolean ,onClick:() => void}) {
        const session = useSession()

        if  (session.status !=="authenticated" || session.data.user.id === userId) {
            return null;
        }
        return <Button disabled={isLoading} onClick={onClick} small  gray={isFollowing}>
            {isFollowing? "Unfollow" : "Follow"}
        </Button> ;
  }
  
  // Initialize plural rules for localized pluralization
  const pluralRules = new Intl.PluralRules();
  
  // Function to get plural form of a word based on count
  function getPlural(number: number, singular: string, plural: string) {
    return pluralRules.select(number) === "one" ? singular : plural;
  }
  
  // Define the getStaticPaths function
  export const getStaticPaths: GetStaticPaths = () => {
    return {
      paths: [],
      fallback: "blocking",
    };
  };
  
  // Define the getStaticProps function
  export async function getStaticProps(context: GetStaticPropsContext<{ id: string }>) {
    const id = context.params?.id;
  
    // Check if id exists, if not, redirect
    if (id == null) {
      return {
        redirect: {
          destination: "/",
        },
      };
    }
  
    // Initialize ssgHelper and prefetch profile data
    const ssg = ssgHelper();
    await ssg.profile.getById.prefetch({ id });
  
    return {
      props: {
        trpcState: ssg.dehydrate(),
        id,
      },
    };
  }
  
  // Export the ProfilePage component as the default export
  export default ProfilePage;
