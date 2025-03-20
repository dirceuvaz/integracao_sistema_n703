import { useState } from 'react';
import styled from 'styled-components';

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

// Estilização do Container Principal
const Container = styled.div`
    text-align: center;
    margin-top: 50px;
`;

// Estilização do Cabeçalho
const Header = styled.header`
    background-color: #003366;
    color: white;
    padding: 20px;
    text-align: center;
    font-size: 2.5em;
    font-weight: 500;
    margin-bottom: 40px;
`;

// Estilização do Título
const Title = styled.h1`
    font-size: 2.5em;
    margin-bottom: 20px;
`;

// Estilização dos Inputs
const Input = styled.input`
    margin: 5px;
    padding: 10px;
    font-size: 1em;
    border: 1px solid #ccc;
    border-radius: 5px;
    width: 300px;
`;

// Estilização do Botão
const Button = styled.button`
    padding: 10px 20px;
    margin-top: 10px;
    font-size: 1em;
    color: #fff;
    background-color: #007bff;
    border: none;
    border-radius: 5px;
    cursor: pointer;

    &:hover {
        background-color: #0056b3;
    }
`;

// Estilização das Mensagens de Erro ou Sucesso
const Message = styled.p`
    margin-top: 20px;
    font-size: 1.2em;
    color: ${props => (props.error ? 'red' : 'green')};
`;

// Estilização do Container de Certificado
const CertificadoContainer = styled.div`
    margin-top: 20px;
    text-align: left;
    display: inline-block;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 5px;
    background-color: #f9f9f9;
`;

// Estilização do Item do Certificado
const CertificadoItem = styled.p`
    font-size: 1.2em;
    margin: 5px 0;
`;

function App() {
    const [cpf, setCpf] = useState('');
    const [nome, setNome] = useState('');
    const [certificado, setCertificado] = useState(null);
    const [mensagem, setMensagem] = useState('');
    const [carregando, setCarregando] = useState(false);

    const solicitarCertificado = async () => {
        console.log('Solicitação de certificado iniciada');
        console.log(`CPF: ${cpf}, Nome: ${nome}`);
        setCarregando(true);

        try {
            const response = await fetch(`${API_URL}/solicitar-certificado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, nome }),
            });

            const data = await response.json();
            console.log('Resposta da API:', data);

            if (data.error) {
                setMensagem(data.error);
                setCertificado(null);
            } else {
                setMensagem('Certificado encontrado!');
                setCertificado(data);
            }
        } catch (error) {
            console.error('Erro ao solicitar certificado:', error);
            setMensagem('Erro ao solicitar certificado. Tente novamente mais tarde.');
            setCertificado(null);
        } finally {
            setCarregando(false);
        }
    };

    return (
        <Container>
            {/* Cabeçalho do Sistema */}
            <Header>
                ValidaCert
            </Header>

            <Title>Consulta de Certificado</Title>
            <Input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
            />
            <Input
                type="text"
                placeholder="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
            />
            <br />
            <Button onClick={solicitarCertificado} disabled={carregando}>
                {carregando ? 'Consultando...' : 'Consultar Certificado'}
            </Button>
            {mensagem && <Message error={!!certificado}>{mensagem}</Message>}
            {certificado && (
                <CertificadoContainer>
                    <CertificadoItem><strong>Nome:</strong> {certificado.nome}</CertificadoItem>
                    <CertificadoItem><strong>CPF:</strong> {certificado.cpf}</CertificadoItem>
                    <CertificadoItem><strong>Data de Conclusão:</strong> {certificado.data_conclusao}</CertificadoItem>
                    <CertificadoItem><strong>Nota:</strong> {certificado.nota}</CertificadoItem>
                </CertificadoContainer>
            )}
        </Container>
    );
}

export default App;
