import { NewTweetForm } from " /components/NewTweetForm";
import { type NextPage } from "next"

const Home: NextPage = () => {
  return <>
  <header className="sticky top-0 z-10 border-b bg-white pt-2" >
    <h1 className="mb-2 px-4 test-lg front-bold"> Home</h1>
  </header>
  <NewTweetForm />
  
  </>;
};

export default Home;