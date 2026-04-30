import { Router, type IRouter } from "express";
import healthRouter from "./health";
import improvRouter from "./improv";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(voiceRouter);
router.use(improvRouter);

export default router;
