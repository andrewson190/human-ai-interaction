import React, { useState } from 'react';
import * as d3 from 'd3-dsv';

function FileUpload() {
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
      setData(csvData.slice(0, 5)); // Show first 5 rows
      setShowPreview(false); 
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
    <div className="flex flex-col items-center w-full mt-5">
      <div
        className={`flex items-center justify-center h-40 w-4/5 border-dashed border-2 ${isDragging ? 'border-gray-400 bg-gray-200' : 'border-gray-300'} p-4`}
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
        <label htmlFor="file-input" className="text-center text-gray-600 cursor-pointer">
          Drag and drop a CSV file here, or click to upload
        </label>
      </div>

      {fileError && <p className="text-red-500">{fileError}</p>}

      {data.length > 0 && (
        <div className="flex flex-col items-center">
          <button 
            className=" mt-5 btn bg-gray-200 rounded-3xl px-6 text-sm text-violet-800"
            onClick={togglePreview}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          
          {showPreview && (
            <div className="data-preview">
              <h3 className="text-lg font-semibold">Data Preview (First 5 Rows)</h3>
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr>
                    {Object.keys(data[0]).map((key) => (
                      <th key={key} className="border border-gray-200 p-2">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
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
