import express from "express";
import { get } from "../controllers/searchController.ts";

const route = express.Router();

route.get("/:source/:type/:query", get);

export default route;