// Import necessary modules
import { z } from "zod";
import {
  createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../trpc";
import { Prisma } from "@prisma/client";
import { inferAsyncReturnType } from "@trpc/server";

// Create a tweetRouter using createTRPCRouter
export const tweetRouter = createTRPCRouter({
  // Define the infiniteProfileFeed query
  infiniteProfileFeed: publicProcedure
    .input(
      z.object({
        userId: z.string(), // Define the input schema with userId, limit, and cursor
        limit: z.number().optional(),
        cursor: z.object({ id: z.number(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ input: { limit = 10, userId, cursor }, ctx }) => {
      const currentUserId = ctx.session?.user.id; // Get the current user's ID from the session
      return await getInfiniteTweets({
        limit,
        ctx,
        cursor,
        whereClause: { userId }, // Use the provided userId for filtering
      });
    }),

  // Define the infiniteFeed query
  infiniteFeed: publicProcedure
    .input(
      z.object({
        onlyFollowing: z.boolean().optional(),
        limit: z.number().optional(),
        cursor: z.object({ id: z.number(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ input: { limit = 10, onlyFollowing, cursor }, ctx }) => {
      const currentUserId = ctx.session?.user.id; // Get the current user's ID from the session
      return await getInfiniteTweets({
        limit,
        ctx,
        cursor,
        whereClause: // Use filtering based on onlyFollowing and currentUserId
          currentUserId == null || !onlyFollowing
            ? undefined
            : {
                user: {
                  followers: { some: { id: currentUserId } },
                },
              },
      });
    }),

  // Define the create mutation
  create: protectedProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input: { text }, ctx }) => {
      const tweet = await ctx.prisma.tweet.create({
        data: {
          content: text,
          userId: ctx.session.user.id, // Use the current user's ID from the session
        },
      });

      void ctx.revalidateSSG?.(`profiles/${ctx.session.user.id}`)

      return tweet;
    }),

  // Define the toggleLike mutation
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      const data = { tweetId: id, userId: ctx.session.user.id }; // Use the current user's ID from the session

      const existingLike = await ctx.prisma.like.findUnique({
        where: { userId_tweetId: data },
      });

      if (existingLike == null) {
        await ctx.prisma.like.create({ data });
        return { addedLike: true };
      } else {
        await ctx.prisma.like.delete({ where: { userId_tweetId: data } });
        return { addedLike: false };
      }
    }),
});

// Define the getInfiniteTweets function
async function getInfiniteTweets({
  whereClause,
  ctx,
  limit,
  cursor,
}: {
  whereClause?: Prisma.TweetWhereInput;
  limit: number;
  cursor: { id: string; createdAt: Date } | undefined;
  ctx: inferAsyncReturnType<typeof createTRPCContext>;
}) {
  const currentUserId = ctx.session?.user.id; // Get the current user's ID from the session

  // Fetch tweets using Prisma
  const data = await ctx.prisma.tweet.findMany({
    take: limit + 1,
    cursor: cursor
      ? { createdAt: cursor.createdAt, id: cursor.id }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: whereClause,
    select: {
      id: true,
      content: true,
      likes: currentUserId == null ? false : { where: { userId: currentUserId } },
      _count: { select: { likes: true } },
      user: {
        select: { name: true, id: true, image: true },
      },
    },
  });

  let nextCursor: typeof cursor | undefined;
  if (data.length > limit) {
    const nextItem = data.pop();
    if (nextItem != null) {
      nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
    }
  }

  // Return formatted tweets and nextCursor
  return {
    tweets: data.map((tweet) => {
      return {
        id: tweet.id,
        content: tweet.content,
        createdAt: tweet.createdAt,
        likeCount: tweet._count.likes,
        user: tweet.user,
        likedByMe: tweet.likes?.length > 0,
      };
    }),
    nextCursor,
  };
}
