import fs from "fs";
import axios from "axios";
import { time } from "console";
import { resolve } from "path";

import mongoose from "mongoose";

interface x {
  routes: {
    distanceMeters: number;
    duration: string;
  }[];
}
require("dotenv").config();

interface Post {
  rent?: string;
  location?: string;
  gender?: "male" | "female";
  distance?:
    | {
        km: number;
        time: string;
      }
    | {
        error: string;
      };
  error?: string;
}

const addDis = async (flats: Post[]) => {
  const filter = flats.filter((e) => !e.error && e.location);
  const ans: Post[] = [];
  for (let i = 0; i < filter.length; i++) {
    const flat = filter[i];
    {
      if (!flat.location) continue;
      const x = await findDis(flat.location, "btm layout 2nd Stage");
      //  console.log(x);
      // add the distacn field
      if (x) {
        const route = x.routes[0];
        let temp = parseInt(route.duration.replace("s", ""), 10);
        //  let temp = parseInt(route.duration);
        temp = temp / 60;
        const timed: string = temp.toString();
        flat.distance = {
          km: route.distanceMeters / 1000,
          time: timed,
        };
      }
      ans.push(flat);
    }
  }
  return ans;
};
const URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const findDis = async (or: string, des: string): Promise<x | null> => {
  /// const URL = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${}&key=${MAP_API_KEY}`;

  try {
    const response = await axios.post(
      URL,
      { origin: { address: or }, destination: { address: des } },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.MAP_API_KEY,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
      }
    );
    //  console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error fetching route:",
      error.response?.data || error.message
    );
    return null;
  }
};
const saveDB = () => {};

export { addDis, findDis };
