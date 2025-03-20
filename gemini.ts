//const API_KEY = "AIzaSyDzckaZ5R9ut1TQKxtX6Jaf5AkgWaA-Ris";
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log(process.env.GEMINI_API_KEY, "gemini api key");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

interface jsonStruc {
  content: string;
  profileUrl: string;
}
interface Post {
  rent?: number;
  location?: string;
  gender?: "male" | "female";
  extra?: string;
  profileUrl: string;
}

import fs from "fs";
//const data = fs.readFileSync("./extractedPosts.json", "utf-8");

const extractPost = async (data: jsonStruc) => {
  // const jsonString = fs.readFileSync("extractedPosts.json", "utf-8");

  const prompt = `Extract the following details from the post and return as a JSON object:
  {
    "rent": (if mentioned, as a number),
    "location": (precise location),
    "gender": (if mentioned: "male", "female", or "any"),
    "extra": (if any special conditions are mentioned like 1BHK 2 BHK or 3BHK) 
  }
  If the post is not about looking for a flatmate , return {"error": "not a flatmate post"}.
  IMPORTANT: Your response must be ONLY a valid JSON object. Do not include any markdown formatting (no \`\`\`json or \`\`\` tags), explanations, or additional text. Just return the raw JSON object seperated by commas to i can easily convert it to json object using json.parse
  

  Post: """${data.content}"""`;
  try {
    const result = await model.generateContent(prompt);
    const response: string = await result.response.text();

    let output;
    try {
      // First try regular JSON parsing
      output = JSON.parse(response) as Post | { error: string };
    } catch (jsonError) {
      // If that fails, try cleaning the response
      let cleanedResponse = response;
      if (response.includes("```")) {
        const matches = response.match(/```(?:json)?([\s\S]*?)```/);
        if (matches && matches[1]) {
          cleanedResponse = matches[1].trim();
          try {
            output = JSON.parse(cleanedResponse) as Post | { error: string };
          } catch (cleanedError) {
            // If still failing, we'll have to return an error
            throw new Error("Failed to parse response");
          }
        } else {
          throw new Error("Couldn't extract JSON from response");
        }
      } else {
        throw new Error("Invalid JSON response");
      }
    }

    if ("error" in output) {
      return { error: "not a flatmate looking post" };
    } else {
      const tot = {
        ...output,
        profileUrl: data.profileUrl,
      };
      // console.log(output);
      return tot;
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    return { error: "failed to extract info from the post" };
  }
};

const processAll = async (
  filepath: string
): Promise<(Post | { error: string })[]> => {
  const rawData = fs.readFileSync(filepath, "utf-8");

  const all: jsonStruc[] = JSON.parse(rawData);
  const result: (Post | { error: string })[] = [];
  for (const each of all) {
    result.push(await extractPost(each));
  }
  return result;
};

//console.log(jsonString);
export { extractPost, processAll };
