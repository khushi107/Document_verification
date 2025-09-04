const express = require('express');
const multer = require('multer');
const { Web3 } = require('web3');  // Import Web3 correctly in v4.x
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const xlsx = require('xlsx');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const PinataSDK = require('@pinata/sdk');
const pinata = new PinataSDK('','');
// Initialize Express and Web3
const app = express();
const port = 3000;
app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, 'DocCredibles_Website')));
const API_KEY = process.env.GEMINI_API_KEY;
const genai = new GoogleGenerativeAI(API_KEY);
const model = genai.getGenerativeModel({ model: "gemini-1.5-pro" });

const web3 = new Web3('http://127.0.0.1:7545'); // Ganache local blockchain
const contractAddress = ''; // Replace with your deployed contract address
const contractABI = [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "string",
          "name": "id",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "cid",
          "type": "string"
        }
      ],
      "name": "HashStored",
      "type": "event"
    },
    {
      "constant": false,
      "inputs": [
        {
          "internalType": "string",
          "name": "id",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_hash",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_cid",
          "type": "string"
        }
      ],
      "name": "storeHash",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "internalType": "string",
          "name": "id",
          "type": "string"
        }
      ],
      "name": "getCids",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "internalType": "string",
          "name": "id",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_hash",
          "type": "string"
        }
      ],
      "name": "verifyHash",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]; // Replace with your contract ABI

const contract = new web3.eth.Contract(contractABI, contractAddress);
const account = ''; // The account that interacts with the smart contract

// Middleware to parse JSON
app.use(express.json());

// Set up file storage for image and excel files using multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ dest: 'uploads/' });

// Upload route for image or excel file
app.post('/upload-file', upload.single('file'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).send('No file uploaded');
    }

    try {
        
if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.mimetype === 'application/vnd.ms-excel') {
            // Handle Excel to JSON
            const storedHashes = await excelToJson(file.path);
            return res.json({ message: 'Excel processed and hashes stored on blockchain', hashes: storedHashes });
        } else {
            return res.status(400).send('Invalid file type');
        }
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).send('Error processing file');
    }
});

// Upload and scan route
app.post('/scan-document', upload.single('image'), async (req, res) => {
    try {
        console.log('Request received at /scan-document');
        
        // Ensure an image is uploaded
        if (!req.file) {
            console.error('No image file uploaded');
            return res.status(400).json({ error: 'No image file uploaded.' });
        }
        console.log('Uploaded file:', req.file);

        const filePath = req.file.path;

        // Read the image file and convert to Gemini API input format
        const imagePart = {
            inlineData: {
                data: fs.readFileSync(filePath, { encoding: 'base64' }),
                mimeType: 'image/jpeg', // Adjust based on uploaded image type
            },
        };

        console.log('Image successfully read and converted for Gemini API');

        // Use Gemini API for OCR
        const prompt = '';

        const model = genai.getGenerativeModel({ model: 'gemini-1.5-pro' });
        console.log('Sending request to Gemini API...');
        const response = await model.generateContent([imagePart, prompt]);
        console.log('Gemini API response received:', response);

        if (!response || !response.response || !response.response.candidates || !response.response.candidates.length) {
            console.error('Gemini API response is invalid or empty');
            return res.status(500).json({ error: 'Failed to extract text using Gemini OCR.' });
        }

        // Extract content from the Gemini API response
        const candidateContent = response.response.candidates[0].content.parts[0].text;
        console.log('Extracted candidate content:', candidateContent);

        let parsedJson;
        try {
            // Parse the extracted content into JSON
            parsedJson = JSON.parse(candidateContent.replace(/^```json\n/, '').replace(/\n```$/, ''));
            console.log('Parsed JSON:', JSON.stringify(parsedJson, null, 2));
        } catch (parseError) {
            console.error('Failed to parse JSON content:', parseError.message);
            return res.status(500).json({ error: 'Failed to parse JSON content.' });
        }

        // Calculate hash of JSON
        const hash = web3.utils.sha3(JSON.stringify(parsedJson,null,2));
        console.log('Calculated hash:', hash);
        const id = parsedJson['Registration No.'];
        // Verify hash on blockchain
        console.log('Verifying hash on blockchain...');
        const isValid = await contract.methods.verifyHash(id,hash).call();
        console.log('Hash verification result:', isValid);

        res.json({
            success: true,
            json: parsedJson,
            hash: hash,
            verified: isValid,
        });
    } catch (error) {
        console.error('Error processing image:', error.message, error.stack);
        res.status(500).json({ error: 'Error processing image.' });
    }
});
async function storeJsonOnIpfs(jsonData) {
    try {
        // Convert JSON to a string
        const jsonString = JSON.stringify(jsonData,null,2);

        // Pin JSON to IPFS (Pinata automatically handles stringified JSON)
        const result = await pinata.pinJSONToIPFS(jsonData);
        console.log('Stored JSON on IPFS:', result.IpfsHash);

        return result.IpfsHash; // CID
    } catch (error) {
        console.error('Error storing JSON on IPFS:', error);
        throw error;
    }
}
// Excel to JSON conversion function
async function excelToJson(filePath) {
    const fieldMapping = {
        "Serial No.": ["Sr. no.", "Serial Number", "sr. no."],
        "Registration No.": ["enrollment", "Reg No.", "Registration No."],
        "School of": ["School", "School of"],
        "Year": ["year", "session", "Academic session"],
        "Name of the Student": ["name", "Student Name", "Full Name"],
        "Father": ["father", "Father Name", "Father's Name"],
        "Mother Name": ["mother", "Mother", "Mother's Name"],
        "Degree": ["degree", "Program", "Degree Programme"],
        "Semester": ["sem", "Semester"],
        "Discipline": ["discipline", "Department", "Branch"],
        "Course No.": ["course no.", "Course_No", "Course Number"],
        "Course Title": ["title", "Course Title", "Course_Title"],
        "Credit": ["credit", "Credits", "Credit Hours"],
        "Grade Earned": ["grade earned", "Grade_Earned", "Grade"],
        "Grade Point": ["points", "Grade Point", "Grade_Point"],
        "Semester Credits Cleared": ["Semester Credits Cleared"],
        "Cumulative Credits Cleared": ["total credits earned", "Cumulative Credits Cleared"],
        "GPA": ["gpa", "Grade Point Average (GPA)"],
        "Cumulative GPA": ["cgpa", "Cumulative GPA", "Cumulative Grade Point Average (CGPA)"],
        "Date": ["date", "Transcript Date"],
    };

    // Standardize field names to match the fieldMapping
    function standardizeFieldName(fieldName) {
        for (const [standardName, synonyms] of Object.entries(fieldMapping)) {
            if (synonyms.some((syn) => syn.toLowerCase() === fieldName.toLowerCase())) {
                return standardName;
            }
        }
        return fieldName; // Return as-is if no match found
    }

    // Clean up and normalize values
    function cleanAndNormalize(value) {
        return typeof value === "string" ? value.trim() : value;
    }

    try {
        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        const studentSheet = workbook.Sheets["students"];
        const courseSheet = workbook.Sheets["courses"];

        if (!studentSheet || !courseSheet) {
            throw new Error("Missing required sheets: 'students' or 'courses'.");
        }

        const studentDataArray = xlsx.utils.sheet_to_json(studentSheet);
        const courseDataArray = xlsx.utils.sheet_to_json(courseSheet);

        const storedHashes = [];

        for (const studentRow of studentDataArray) {
            const jsonData = {
                University: "",
                "Serial No.": null,
                "School of": null,
                Year: null,
                "Registration No.": null,
                "Name of the Student": null,
                Father: null,
                "Mother Name": null,
                Degree: null,
                Semester: null,
                Discipline: null,
                "course details": [],
                additional_details: {}
            };

            // Map student fields
            for (const key in studentRow) {
                const standardizedKey = standardizeFieldName(key);
                jsonData[standardizedKey] = cleanAndNormalize(studentRow[key]);
            }

            for (const key in studentRow) {
                const standardizedKey = standardizeFieldName(key);
                if (jsonData.hasOwnProperty(standardizedKey)) {
                    jsonData[standardizedKey] = cleanAndNormalize(studentRow[key]);
                } else {
                    jsonData.additional_details[standardizedKey] = cleanAndNormalize(studentRow[key]);
                }
            }

            // Add related course details
            const registrationNo = jsonData["Registration No."];
            console.log(`Looking for courses for student with Registration No.: ${registrationNo}`);
            
            jsonData["course details"] = courseDataArray
                .filter(course => cleanAndNormalize(course["enrollment"]) === registrationNo)
                .map(course => {
                    const courseDetails = {};
                    for (const key in course) {
                        const standardizedKey = standardizeFieldName(key);
                        if (standardizedKey !== "Registration No.") { // Avoid duplicate Registration No.
                            courseDetails[standardizedKey] = cleanAndNormalize(course[key]);
                        }
                    }
                    return courseDetails;
                });
  
            const additionalFields = ["Total Credits Offered till this Semester", "Semester Credits Cleared", "Cumulative Credits Cleared", "GPA", "Cumulative GPA","Date"];
            for (const field of additionalFields) {
                if (jsonData[field]) {
                    jsonData.additional_details[field] = jsonData[field];
                    delete jsonData[field];
                }
            }
            console.log(JSON.stringify(jsonData, null, 2));
            // Save individual JSON to a file named after Registration No.
            const outputFileName = `${registrationNo || "output"}.json`;
            //here ipfs should be implemented, created json should be stored and cid returned store in a variable
            const outputFilePath = path.join(__dirname, 'uploads', outputFileName);
            fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
            const cid = await storeJsonOnIpfs(jsonData);
            // Generate hash from JSON and store it
            const jsonHash = await getJsonHash(jsonData);
            const id = registrationNo; // Use registration number as ID
            console.log(`Storing hash for ID: ${id}`);
            console.log(`Hash: ${jsonHash}`);
            console.log(`CID for JSON: ${cid}`);
            //after updating the function , store cid also to blockchain like :(is,jsonHash,cid);
            await storeHashOnBlockchain(id, jsonHash,cid);
            storedHashes.push({ id, hash: jsonHash });
        }

        return storedHashes;
    } catch (error) {
        throw new Error('Error processing Excel file');
    }
}

// Helper function to get JSON hash
async function getJsonHash(jsonData) {
    const jsonString = JSON.stringify(jsonData,null,2);
    return web3.utils.sha3(jsonString);  // SHA3 hash for Ethereum-based applications
}

// Store hash on the blockchain
async function storeHashOnBlockchain(id, jsonHash,cid) {
    try {
        const receipt = await contract.methods.storeHash(id, jsonHash,cid).send({ from: account,gas: 300000 });
        console.log(`Hash stored for ${id}:`, receipt);
    } catch (error) {
        console.error('Error storing hash on blockchain:', error);
    }
}
// Endpoint to fetch CIDs from the blockchain for a given enrollment ID
app.get('/get-cids/:enrollmentId', async (req, res) => {
    const { enrollmentId } = req.params;

    if (!enrollmentId) {
        return res.status(400).json({ error: 'Enrollment ID is required' });
    }

    try {
        // Interact with the smart contract to fetch CIDs
        const cids = await contract.methods.getCids(enrollmentId).call();

        if (cids.length === 0) {
            return res.status(404).json({ message: 'No CIDs found for the given Enrollment ID.' });
        }

        // Return the CIDs in the response
        res.json({ enrollmentId, cids });
    } catch (error) {
        console.error('Error fetching CIDs from blockchain:', error);
        res.status(500).json({ error: 'Failed to fetch CIDs. Please try again later.' });
    }
});
app.get('/fetch-ipfs/:cid', async (req, res) => {
    const { cid } = req.params;

    if (!cid) {
        return res.status(400).json({ error: 'CID is required.' });
    }

    try {
        // IPFS Gateway URL to fetch data
        const ipfsGatewayUrl = `https://ipfs.io/ipfs/${cid}`;

        // Fetching data from IPFS
        const response = await axios.get(ipfsGatewayUrl);

        // Sending IPFS data as response
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from IPFS:', error.message);
        res.status(500).json({ error: 'Failed to fetch data from IPFS. Please check the CID or try again later.' });
    }
});
// Start the Express server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


