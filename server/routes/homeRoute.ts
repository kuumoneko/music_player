import express from "express";
import { get } from "../controllers/homeController.ts";

const route = express.Router();

route.get("/", get);

export default route;