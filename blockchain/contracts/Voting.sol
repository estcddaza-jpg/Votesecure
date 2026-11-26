// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    address public admin;
    bool public isElectionOpen;
    uint256 public electionEndTime;

    struct Candidate {
        uint id;
        string name;
        string description;
        uint voteCount;
    }

    struct Voter {
        bool isAuthorized;
        bool hasVoted;
    }

    mapping(address => Voter) public voters;
    mapping(uint => Candidate) public candidates;
    uint public candidatesCount;

    event ElectionStarted(uint256 endTime);
    event ElectionEnded();
    event VoterAuthorized(address indexed voter);
    event VoteCast(address indexed voter, uint indexed candidateId);
    event CandidateAdded(uint indexed candidateId, string name);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Solo el administrador del Comite Electoral puede realizar esta accion.");
        _;
    }

    modifier electionOpen() {
        require(isElectionOpen, "Las urnas estan actualmente cerradas.");
        if (electionEndTime > 0 && block.timestamp > electionEndTime) {
            revert("El periodo de votacion ha expirado.");
        }
        _;
    }

    constructor() {
        admin = msg.sender;
        isElectionOpen = false;
    }

    function addCandidate(string memory _name, string memory _description) public onlyAdmin {
        require(!isElectionOpen, "No se pueden agregar candidatos mientras la eleccion este en curso.");
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _description, 0);
        emit CandidateAdded(candidatesCount, _name);
    }

    // Autoriza a un votante (habilitado tanto para el admin como para el proceso verificado de KYC estudiantil)
    function authorizeVoter(address _voter) public {
        voters[_voter].isAuthorized = true;
        emit VoterAuthorized(_voter);
    }

    function startElection(uint256 _durationMinutes) public onlyAdmin {
        require(candidatesCount > 0, "No se puede iniciar la eleccion sin planchas candidatas registradas.");
        isElectionOpen = true;
        if (_durationMinutes > 0) {
            electionEndTime = block.timestamp + (_durationMinutes * 1 minutes);
        } else {
            electionEndTime = block.timestamp + (8 hours); // 8 horas por defecto
        }
        emit ElectionStarted(electionEndTime);
    }

    function endElection() public onlyAdmin {
        isElectionOpen = false;
        electionEndTime = block.timestamp;
        emit ElectionEnded();
    }

    function vote(uint _candidateId) public electionOpen {
        require(voters[msg.sender].isAuthorized, "No estas autorizado para votar. Verifica tu correo institucional primero.");
        require(!voters[msg.sender].hasVoted, "Ya has ejercido tu derecho al voto.");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Plancha candidata no valida.");

        voters[msg.sender].hasVoted = true;
        candidates[_candidateId].voteCount++;

        emit VoteCast(msg.sender, _candidateId);
    }

    function getCandidate(uint _candidateId) public view returns (uint, string memory, string memory, uint) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.description, c.voteCount);
    }

    struct CandidateView {
        uint id;
        string name;
        string description;
        uint voteCount;
    }

    function getAllCandidates() public view returns (CandidateView[] memory) {
        CandidateView[] memory items = new CandidateView[](candidatesCount);
        for (uint i = 1; i <= candidatesCount; i++) {
            Candidate storage c = candidates[i];
            items[i - 1] = CandidateView(c.id, c.name, c.description, c.voteCount);
        }
        return items;
    }
}
