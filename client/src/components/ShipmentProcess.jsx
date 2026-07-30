import React from "react";
import "./ShipmentProcess.css";
import {
  FaBox,
  FaRobot,
  FaTruckMoving,
  FaCheckCircle
} from "react-icons/fa";


const ShipmentProcess = () => {

  return (

    <section className="shipment-process">


      <div className="process-header">

        <p>
          OUR WORKFLOW
        </p>

        <h2>
          Complete Shipment Process
        </h2>

        <span>
          From quotation generation to final delivery,
          manage your complete logistics journey easily.
        </span>

      </div>



      <div className="process-wrapper">



        <div className="process-box">

          <div className="process-icon">
            <FaBox />
          </div>

          <h3>
            01. Shipment Request
          </h3>

          <p>
            Enter shipment details including
            source, destination and cargo information.
          </p>

        </div>




        <div className="process-box">

          <div className="process-icon">
            <FaRobot />
          </div>

          <h3>
            02. AI Quote Generation
          </h3>

          <p>
            Our intelligent AI system analyzes
            data and generates accurate freight quotes.
          </p>

        </div>





        <div className="process-box">

          <div className="process-icon">
            <FaTruckMoving />
          </div>

          <h3>
            03. Shipment Tracking
          </h3>

          <p>
            Track shipment movement with
            real-time logistics updates.
          </p>

        </div>





        <div className="process-box">

          <div className="process-icon">
            <FaCheckCircle />
          </div>

          <h3>
            04. Safe Delivery
          </h3>

          <p>
            Complete your shipment successfully
            with reliable delivery management.
          </p>

        </div>



      </div>


    </section>

  );

};


export default ShipmentProcess;