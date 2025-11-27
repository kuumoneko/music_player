import express from "express";
import { get } from "../controllers/playController.js";

const route = express.Router();

route.get("/:source/:id", get);

export default route;