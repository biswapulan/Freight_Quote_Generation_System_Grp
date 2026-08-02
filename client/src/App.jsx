import { Routes, Route } from "react-router-dom";
import ProfessionalLanding from "./components/ProfessionalLanding";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";


function App(){

return(

<Routes>

<Route path="/" element={<ProfessionalLanding/>}/>

<Route path="/login" element={<AuthPage/>}/>

<Route path="/dashboard" element={<Dashboard/>}/>

</Routes>

)

}


export default App;
