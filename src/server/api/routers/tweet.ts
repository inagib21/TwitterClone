import { z } from "zod";
import { createTRPCContext, createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { Prisma } from "@prisma/client";
import { inferAsyncReturnType } from "@trpc/server";
import { text } from "node:stream/consumers";


export const tweetRouter = createTRPCRouter({
  infiniteFeed: publicProcedure.input(
    z.object({
      onlyFollowing: z.boolean().optional(),
      limit: z.number().optional(),
      cursor: z.object({ id: z.number(), createdAt: z.date() }).optional(),
    })
  ).query(async ({ input: { limit = 10, onlyFollowing = false ,cursor }, ctx }) => 
  {
    const currentUserId =  ctx.session?.user.id
    return await getInfiniteTweets({
      limit, ctx, cursor, whereClause:  currentUserId  == null ||!onlyFollowing ?
    undefined :{
      user:{
        followers: {some:  {id: currentUserId},}
      }
    }
  })
  }),

  create: protectedProcedure
    .input(z.object({ text: z.string() }))
    .mutation(async ({ input: { text }, ctx }) => {
      const tweet = await ctx.prisma.tweet.create({
        data: {
          content: text,
          userId: ctx.session.user.id,
        },
      });

      return tweet;
    }),
    toggleLike: protectedProcedure.input(z.object({id: z.string() })).mutation(async ({ input: { id }, ctx }) => {
      const data = {tweetId: id, userId: ctx.session.user.id }

      const existingLike = await ctx.prisma.like.findUnique({
        where: {userId_tweetId: data}
      })

      if (existingLike == null) {
        await ctx.prisma.like.create({data})
        return {addedLike: true}
      } else  {
        await ctx.prisma.like.delete({where: {userId_tweetId: data}})
        return {addedLike: false}
      }
    }),
});



async function getInfiniteTweets({
  whereClause,
  ctx, limit, cursor
}:{ whereClause?:Prisma.TweetWhereInput, limit: number, cursor:{id:string,
createdAt: Date} | undefined,  ctx: inferAsyncReturnType<typeof createTRPCContext> }){
  const currentUserId = ctx.session?.user.id;
   
  const data = await ctx.prisma.tweet.findMany({
    take: limit + 1,
    cursor: cursor ? { createdAt: cursor.createdAt, id: cursor.id } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: whereClause,
    select: {
      id: true,
      content: true,
      likes: currentUserId == null ? false : { where: { userId: currentUserId } },
      _count: { select: { likes: true } },
      user: {
        select: { name: true, id: true, image: true }
      }
    }
  });
  
  let nextCursor: typeof cursor | undefined;
  if (data.length > limit) {
    const nextItem = data.pop();
    if (nextItem != null) {
      nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
    }
  }

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
    nextCursor
  };
}