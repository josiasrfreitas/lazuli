import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@lazuli/auth/server";

export const { GET, POST } = toNextJsHandler(auth);
