import { getServerSidePropsUserHoc } from 'back/UserPage'
import UserPage from 'front/UserPage'
export const getServerSideProps = getServerSidePropsUserHoc('follows')
export default UserPage
