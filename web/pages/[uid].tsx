import { getStaticPathsProfile, getStaticPropsProfile } from "lib/profile"
import ProfileHoc from "components/Profile"
export const getStaticPaths = getStaticPathsProfile
export const getStaticProps = getStaticPropsProfile
const Profile = ProfileHoc('user-articles-top')
export default Profile
