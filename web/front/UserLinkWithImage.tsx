/* A link to a user profile that includes a small profile picture. */

import CustomLink from 'front/CustomLink'
import CustomImage from 'front/CustomImage'
import { UserType } from 'front/types/userType'
import routes from 'front/routes'
import { DisplayAndUsername } from 'front/user'

const UserLinkWithImage = ({ user, showUsername }: {
  user: UserType,
  showUsername: bool,
}) => {
  if (!user) return null;
  return (
    <CustomLink
      href={routes.userView(user.username)}
      className="author username"
    >
      <CustomImage
        src={user.effectiveImage}
        className="profile-thumb"
        alt="author profile image"
      />
      {' '}
      <DisplayAndUsername
      showUsername={showUsername}
      user={user}
      ></DisplayAndUsername>
    </CustomLink>
  )
}

export default UserLinkWithImage;
