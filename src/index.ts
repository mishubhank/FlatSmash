import puppeteer from "puppeteer-extra";
import fs from "fs";
import { Browser } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import mongoose from "mongoose";
import { executablePath, PuppeteerError } from "puppeteer";
import { PassThrough } from "stream";
import { resolve } from "path";
import { exitCode } from "process";
import { extractPost, processAll } from "../gemini";
import { addDis } from "../mapAPI";
import { stringify } from "querystring";
require("dotenv").config();

const COOKIE_FILE = "cookies.json";

let post_ar: Post[] = [];

// mongoose
//   .connect(
//     "mongodb+srv://shubhank1011:u4rH4BsB1IG4gQHD@cluster0.uarbh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
//   )
//   .then(() => {
//     console.log("Connected to the database");
//   })
//   .catch((err) => {
//     console.log(err);
//   });
//  u4rH4BsB1IG4gQHD

puppeteer.use(StealthPlugin());

interface Post {
  rent?: string;
  location?: string;
  gender?: "male" | "female";
  distance?: {
    km: number;
    time: string;
  };
  error?: string;
}
//console.log(process.env.EMAIL);
async function main() {
  await scrape();
  await filterAndSave();
  await calDis();
}
main();

async function checkLogin(page: any): Promise<boolean> {
  try {
    const loggedIn = await page.evaluate(() => {
      const userMenu = document.querySelector('div[aria-label="Your profile"]');
      const feedContent = document.querySelector('div[role="feed"]');
      return !!userMenu || !!feedContent;
    });
    return loggedIn;
  } catch {
    console.log("error checking");
    return false;
  }
}

async function loadCookies(page: any): Promise<boolean> {
  if (!fs.existsSync(COOKIE_FILE)) {
    console.log("No cookies found");
    return false;

    return true;
  }
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
    await page.setCookie(...cookies);
    console.log('Loaded cookies from "cookies.json"');
    return true;
  } catch {
    console.log("error loading cookies");
    return false;
  }
}
const handleLogin = async (page: any) => {
  await page.goto("https://www.facebook.com/login", {
    waitUntil: "networkidle2",
  });

  await page.type("#email", process.env.EMAIL);
  await page.type("#pass", process.env.PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  const check = await checkLogin(page);
  if (!check) {
    console.log("not logged in  try manual ");
    console.log("waiting for 50s");

    await new Promise((resolve) => setTimeout(resolve, 50000));

    const manual = await checkLogin(page);
    if (manual) {
      console.log("logged in manually");
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
      return true;
    } else {
      console.log("not logged in manual");
      return false;
    }
  }

  console.log("Login successful!");
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
  return true;
};

async function scrape() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-notifications"],
    executablePath: executablePath(),
  });

  const page = await browser.newPage();
  let logged = false;
  // Load cookies if available (for logged-in session)
  if (await loadCookies(page)) {
    //  await page.goto(
    //    "https://www.facebook.com/groups/1019544874745682/?sorting_setting=CHRONOLOGICAL"
    //  );
    await page.goto("https://www.facebook.com ");
    logged = await checkLogin(page);
    if (!logged) {
      console.log("not logged in cookie expired");
      logged = await handleLogin(page);
    } else {
      console.log("logged in using cookies");
    }
  } else {
    await handleLogin(page);
  }
  if (!logged) {
    console.log("not logged in ");
    await browser.close();

    return;
  }
  console.log("go to group");
  //www.facebook.com/groups/1019544874745682/?sorting_setting=CHRONOLOGICAL

  // Go to the Facebook group page
  await page.goto(
    "  https://www.facebook.com/groups/1019544874745682/?sorting_setting=CHRONOLOGICAL",
    {
      waitUntil: "networkidle2",
    }
  );

  // Scroll to load more posts
  await infiniteScroll(page);

  // Click "See More" to Expand Hidden Text
  await clickSeeMore(page);

  // Extract all posts after expanding
  let posts = await page.$$eval(
    "div[data-ad-rendering-role='story_message']",
    (elements) =>
      elements.map((el) => {
        const content = el.innerText.trim();

        // Manually traverse up the DOM to find the correct container
        let parent = el.parentElement;
        while (
          parent &&
          !parent.querySelector("div[data-ad-rendering-role='profile_name']")
        ) {
          parent = parent.parentElement; // Keep moving up
        }

        // Now, find the profile_name div
        const profileNameDiv = parent?.querySelector(
          "div[data-ad-rendering-role='profile_name']"
        );

        // Extract the profile link
        const profileAnchor = profileNameDiv?.querySelector("a");

        //console.log(profileAnchor, "Profile Anchor"); // Debugging
        const profileUrl = profileAnchor ? profileAnchor.href : null;
        // console.log(profileUrl, "Profile URL"); // Debugging

        return { content, profileUrl };
      })
  );

  //console.log("Extracted Posts:", posts);
  //fs.writeFileSync("extractedPosts.json", JSON.stringify(posts, null, 2));

  await browser.close();

  // console.log("Extracted Posts:", posts);
  //fs.writeFileSync("extractedPosts.json", JSON.stringify(posts, null, 2));
  //console.log("Extracted Posts:", posts);

  await browser.close();
}

// **Scroll to Load More Posts**
async function infiniteScroll(page: any, maxScrolls: number = 1) {
  while (maxScrolls--) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}

// **Click "See More" Buttons to Expand Posts**

const hash = [];

async function clickSeeMore(page: any) {
  let seeMoreButtons = await page.$$(
    'div[data-ad-rendering-role="story_message"] div[role="button"][tabindex="0"]'
    // await page.waitForTimeout(3000)
  );

  for (const button of seeMoreButtons) {
    try {
      await button.evaluate((b: any) => b.click()); // Click using browser context
      await page.waitForTimeout(5000); // Wait for expanded text to load
    } catch (e) {
      console.log("Skipping a button that could not be clicked.");
    }
  }
}

const filterAndSave = async () => {
  try {
    console.log("Starting to process posts...");
    const savethis = await processAll("./extractedPosts.json");
    fs.writeFileSync("./filtered.json", JSON.stringify(savethis, null, 2));
    //  console.log("Saved the filtered file in filtered.json");
    console.log(`Processed ${savethis.length} items.`);
  } catch (error) {
    console.error("Error in filterAndSave:", error);
  }
};
// const
//   extractPost(test)
async function calDis() {
  const read = await fs.readFileSync("./filtered.json", "utf-8");
  const all: Post[] = JSON.parse(read);

  const finalll = await addDis(all);
  fs.writeFileSync("./jason.json", JSON.stringify(finalll, null, 2));
}

async function isMatch() {}
