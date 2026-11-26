const hre = require("hardhat");

async function main() {
  console.log("Compilando y desplegando contrato Voting en FESC Network...");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  
  console.log("VoteSecure Smart Contract desplegado en:", address);

  // Registrar planchas oficiales según la propuesta académica
  console.log("Registrando planchas estudiantiles...");
  
  let tx1 = await voting.addCandidate(
    "Plancha 01 - Innovación & Tecnología FESC", 
    "Modernización de laboratorios de software, fortalecimiento del campus virtual, hackathons y convenios tecnológicos para prácticas profesionales."
  );
  await tx1.wait();
  
  let tx2 = await voting.addCandidate(
    "Plancha 02 - Liderazgo & Bienestar Universitario", 
    "Mejora integral de espacios de esparcimiento, subsidios de cafetería, fomento del deporte universitario y becas de apoyo estudiantil."
  );
  await tx2.wait();
  
  // Opcional: Iniciar la elección por defecto (8 horas) para que esté lista para votar
  let txStart = await voting.startElection(480);
  await txStart.wait();

  console.log("Planchas registradas y urnas abiertas con éxito.");
  console.log("DIRECCIÓN DEL CONTRATO:", address);
}

main().catch((error) => {
  console.error("Error durante el despliegue:", error);
  process.exitCode = 1;
});
