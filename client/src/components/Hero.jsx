import React from "react";
import "./Hero.css";
import freight from "../assets/freight.png";
import { FaArrowRight, FaPlane, FaShip, FaTruck, FaTrain } from "react-icons/fa";

function Hero() {

  return (

    <section
      className="hero"
      style={{
        backgroundImage: `url(${freight})`
      }}
    >

      <div className="hero-overlay"></div>


      <div className="hero-container">


        <div className="hero-left">


          <p className="hero-tag">
            AI POWERED ENTERPRISE LOGISTICS PLATFORM
          </p>


          <h1>
            Intelligent Freight
            <br/>
            Quote Generation
            <br/>
            System
          </h1>


          <p className="hero-description">

            Transform your logistics operations with
            AI-powered freight quotation, shipment tracking,
            and smart supply chain management for global businesses.

          </p>



          <div className="hero-buttons">

            <button className="primary-btn">
              Get Started
            </button>


            <button className="secondary-btn">

              Get Quote
              <FaArrowRight/>

            </button>


          </div>



          <div className="transport-icons">


            <div>
              <FaPlane/>
              <span>Air</span>
            </div>


            <div>
              <FaShip/>
              <span>Ocean</span>
            </div>


            <div>
              <FaTruck/>
              <span>Road</span>
            </div>


            <div>
              <FaTrain/>
              <span>Rail</span>
            </div>


          </div>


        </div>




        <div className="hero-card">


          <h3>
            Instant Freight Quote
          </h3>


          <p>
            Generate AI based pricing instantly
          </p>


          <div className="quote-item">
            <span>Origin</span>
            <b>New York</b>
          </div>


          <div className="quote-item">
            <span>Destination</span>
            <b>London</b>
          </div>


          <div className="quote-item">
            <span>Delivery</span>
            <b>Express</b>
          </div>



          <button className="generate-btn">
            Generate Quote
          </button>


        </div>


      </div>




      <div className="hero-stats">


        <div>
          <h2>10K+</h2>
          <p>Shipments</p>
        </div>


        <div>
          <h2>120+</h2>
          <p>Countries</p>
        </div>


        <div>
          <h2>99.8%</h2>
          <p>Success Rate</p>
        </div>


        <div>
          <h2>24/7</h2>
          <p>Support</p>
        </div>


      </div>


    </section>

  )

}

export default Hero;