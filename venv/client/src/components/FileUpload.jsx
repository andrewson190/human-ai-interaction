import React, { useState } from 'react';
import * as d3 from 'd3-dsv';

function FileUpload(props) {
  const [fileError, setFileError] = useState("");
  const [data, setData] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false); 

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (!file.name.endsWith('.csv')) {
        setFileError("Only CSV files are supported.");
        return;
    }

    setFileError("");
    const reader = new FileReader();
    reader.onload = (event) => {
        const csvData = d3.csvParse(event.target.result, d3.autoType);
        props.handleData(csvData);
        
        // Preview top 100 and bottom 100 rows
        const topRows = csvData.slice(0, 10);
        const bottomRows = csvData.slice(-200);
        const previewData = topRows.concat(bottomRows); // Combine both arrays
        const preview = csvData.slice(0,5)
        // Set the preview data
        setData(preview);
        // Create metadata as a list of dictionaries for the entire dataset
        const metadata = previewData.map(row => {
            return Object.keys(row).reduce((acc, key) => {
                acc[key] = row[key];
                return acc;
            }, {});
        });

        // Pass the new metadata structure to the parent component
        props.onMetadataChange(metadata);
    };
    reader.readAsText(file);
};



  
  
  
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full mt-5 mb-5">
      <label
        htmlFor="file-input"
        className={`flex flex-col items-center justify-center w-4/5 border-dashed border-2 rounded-lg ${
          isDragging ? 'border-gray-400 bg-gray-200' : 'border-gray-300'
        } p-4`}
        style={{ borderStyle: 'dashed', height: "100px", cursor: "pointer" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="file-input"
        />
        <span className="text-center text-gray-600">
          Drag and drop a CSV file here, or click to upload
        </span>
      </label>

      {fileError && <p className="text-red-500">{fileError}</p>}

      {data.length > 0 && (
        <div className="flex flex-col items-center justify-center">
            <button 
            className="mt-5 btn bg-gray-200 rounded-3xl px-6 text-sm text-violet-800"
            onClick={togglePreview}
            >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            
            {showPreview && (
            <div >
                <h3 className="text-lg font-semibold">Data Preview (First 5 Rows)</h3>
                <table className="min-w-full border border-gray-200">
                <thead>
                    <tr>
                    <th className="border border-gray-200 p-2">#</th> 
                    {data.length > 0 && Object.keys(data[0]).map((key) => (
                        <th key={key} className="border border-gray-200 p-2">{key}</th>
                    ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                    <tr key={index}>
                        <td className="border border-gray-200 p-2">{index + 1}</td> 
                        {Object.values(row).map((value, idx) => (
                        <td key={idx} className="border border-gray-200 p-2">{value}</td>
                        ))}
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            )}
        </div>
    )}

    </div>
  );
}

export default FileUpload;
