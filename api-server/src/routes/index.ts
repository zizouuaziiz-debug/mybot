import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import walletRouter from "./wallet";
import tasksRouter from "./tasks";
import referralsRouter from "./referrals";
import spinRouter from "./spin";
import miningRouter from "./mining";
import earnRouter from "./earn";
import vipRouter from "./vip";
import depositRouter from "./deposit";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/wallet", walletRouter);
router.use("/tasks", tasksRouter);
router.use("/referrals", referralsRouter);
router.use("/rewards", spinRouter);
router.use("/mining", miningRouter);
router.use("/earn", earnRouter);
router.use("/vip", vipRouter);
router.use(depositRouter);
router.use("/admin", adminRouter);

export default router;
