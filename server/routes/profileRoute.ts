import express from "express";
import { get, post } from "../controllers/profileController.js";

const route = express.Router();

route.get("/:key", get);

route.post("/:key", post)

export default route;