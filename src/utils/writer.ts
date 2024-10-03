import fs from 'fs';
import { outputFolder } from './constant';

export function outputWriter(data: string, fileName: string): void {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  fs.writeFileSync(outputFolder + fileName, data);
}
