import { cache } from "react";

import { getCafeBySlug } from "@/lib/cafe-repository";

// Uma query por request, compartilhada entre o layout, o metadata e a página.
export const getCafe = cache(getCafeBySlug);
