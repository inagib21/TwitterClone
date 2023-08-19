import { appRouter } from " /server/api/root"
import { createInnerTRPCContext } from " /server/api/trpc"
import { createServerSideHelpers} from "@trpc/react-query/server"
import superjson from "superjson"

export function ssgHelper(){
    return createServerSideHelpers({
        router: appRouter,
        ctx: createInnerTRPCContext({ session: null}) ,
        transformer: superjson,
    });
};