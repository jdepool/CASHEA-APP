import { useState } from 'react';
import { FileUpload } from '../FileUpload';

export default function FileUploadExample() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="p-6 max-w-2xl">
      <FileUpload
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
        onClearFile={() => setSelectedFile(null)}
      />
    </div>
  );
}
