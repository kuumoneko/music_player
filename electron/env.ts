import fs, { writeFileSync, constants } from "node:fs";
import path from "node:path"
import { access } from 'fs/promises';

export async function createFolders(folderPaths: string[]) {
  for (const folder of folderPaths) {
    try {
      await fs.promises.mkdir(folder, { recursive: true });
      console.log(`Folder '${folder}' created or already exists.`);
    } catch (error) {
      console.error(`Error creating folder ${folder} with error: ${error.message}`);
      throw new Error(error)
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function createMultipleFiles(files: any[]) {
  for (const file of files) {
    try {
      const is_existed = await fileExists(path.join(file.folderPath, file.filename));
      if (!is_existed) {
        writeFileSync(path.join(file.folderPath, file.filename), file.fileContent);
        console.log(`file ${file.filename} created successfully!`);
      }
      else {
        console.log(`file ${file.filename} is existed!`);
      }
    } catch (err) {
      console.error('Error creating files:', err);
      throw new Error(err)
    }
  }

}