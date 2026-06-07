import React from 'react';

const CarrierResult = ({ data }) => {
  const { 
    international_format, 
    country_name, 
    location, 
    carrier, 
    line_type 
  } = data;

  const getCarrierName = () => {
    if (!carrier) return "Unknown Carrier";
    return carrier;
  };

  return (
    <div className="result-card">
      <div className="result-header">
        <div className="status-badge valid">Active Number</div>
        <h2>{international_format}</h2>
      </div>
      
      <div className="result-grid">
        <div className="result-item">
          <div className="item-label">Carrier Network</div>
          <div className="item-value carrier-highlight">{getCarrierName()}</div>
        </div>
        
        <div className="result-item">
          <div className="item-label">Line Type</div>
          <div className="item-value capitalize">{line_type || 'Unknown'}</div>
        </div>

        <div className="result-item">
          <div className="item-label">Country</div>
          <div className="item-value">{country_name}</div>
        </div>

        <div className="result-item">
          <div className="item-label">Location</div>
          <div className="item-value">{location || 'N/A'}</div>
        </div>
      </div>
    </div>
  );
};

export default CarrierResult;
