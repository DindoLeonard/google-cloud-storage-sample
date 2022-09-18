import * as dotenv from 'dotenv';
dotenv.config();
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import https from 'https';
import fs from 'fs';
import multer from 'multer';

// UPLOAD IMGE FUNCTION

const PORT = 3500;

const multerMid = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const app = express();
app.use(cors());
app.use(multerMid.single('file'));
app.use(express.json());

const projectId = 'kitkat-finance-tracker';
const keyFile = 'kitkat-finance-tracker-631a8535c341';

export const storage = new Storage({
  keyFile,
  projectId,
});

const bucket = storage.bucket('kitkat_example_bucket');

const uploadImage = (file: Express.Multer.File) =>
  new Promise((resolve, reject) => {
    const { originalname, buffer } = file;

    const blob = bucket.file(
      'example-folder/' + originalname.replace(/ /g, '_')
    );
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      })
      .on('error', () => {
        reject('Unable to upload image, something went wrong');
      })
      .end(buffer);
  });

app.get('/view', async (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

  console.log(req.method + ' : ' + fullUrl);
  next();
});

app.get(
  '/list-bucket',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [buckets] = await storage.getBuckets();

      const result: string[] = [];

      buckets.forEach((bucket) => {
        result.push(bucket.name);
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.log(err);
      res.status(400).send(JSON.stringify(err));
    }
  }
);

app.get('/get-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allFiles = await bucket.getFiles({
      delimiter: '/another-folder',
      prefix: 'another-folder',
    });

    const allFiles2 = await bucket.getFiles({
      delimiter: '/example-folder',
      prefix: 'example-folder',
    });

    const allEndpoints = allFiles2?.[0]
      ?.map((fileData) => {
        const publicUrl = fileData.publicUrl();

        return publicUrl;
        // return `https://storage.googleapis.com/kitkat_example_bucket/${fileData?.id}`;
      })
      .filter(
        (fileString) =>
          fileString !== `https://storage.googleapis.com/another-folder/`
      );

    res.status(200).json({
      success: true,
      data: allEndpoints,
    });
  } catch (err) {
    next(err);
  }
});

app.get(
  '/get-file/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;

      const fileRef = bucket.file(filename);

      const fileExists = await fileRef.exists();

      if (!fileExists) {
        throw Error("File doesn't exists");
      }

      return res.status(200).json({
        success: true,
        data: fileRef,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.delete(
  '/delete/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;

      const formattedFilename = filename.replace(/ /g, '_');

      const fileRef = bucket.file(formattedFilename);

      const fileExists = await fileRef.exists();

      console.log(fileExists);

      if (fileExists) {
        console.log(fileExists);
        const result = await fileRef.delete();

        return res.status(200).json({
          success: true,
          data: result,
        });
      }

      res.status(200).json({
        success: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

app.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const myFile = req.file;
    console.log(myFile);

    if (myFile) {
      const imageUrl = await uploadImage(myFile);

      return res.status(200).json({
        success: true,
        data: imageUrl,
      });
    } else {
      throw new Error('No files selected');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.get('/hello', async (req: Request, res: Response) => {
  console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log(path.join(__dirname, 'kitkat-finance-tracker-631a8535c341.json'));
  res.status(200).json({ data: 'hello' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

https
  .createServer(
    {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
    },
    app
  )
  .listen(PORT, () => {
    console.log(`app running in port ${PORT}`);
  });

// app.listen(PORT, () => {
//   console.log(`app running in port ${PORT}`);
// });
