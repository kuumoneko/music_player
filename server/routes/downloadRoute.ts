import express from "express";
import { download_status, get } from "../controllers/downloadController.js";

const route = express.Router();

route.get("/", get);

route.get("/status", download_status);

export default route;