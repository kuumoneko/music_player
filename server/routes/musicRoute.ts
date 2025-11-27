import express from "express";
import { get } from "../controllers/musicController.js";

const route = express.Router();

route.get("/:source/:type/:id", get);

export default route;